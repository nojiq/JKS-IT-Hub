import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");

import usersRoutes from "../../apps/api/src/features/users/routes.js";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";

const baseConfig = {
  jwt: {
    secret: "test-secret-test-secret",
    issuer: "it-hub",
    audience: "it-hub-web",
    expiresIn: "1h"
  },
  cookie: {
    name: "it-hub-session",
    secure: true,
    sameSite: "lax"
  },
  ldapSync: {
    attributes: ["cn", "mail"],
    usernameAttribute: "uid"
  }
};

const createSessionCookie = async (user) => {
  const token = await signSessionToken(
    {
      subject: user.id,
      payload: {
        username: user.username,
        role: user.role,
        status: user.status
      }
    },
    baseConfig.jwt
  );

  return `${baseConfig.cookie.name}=${token}`;
};

const createInMemoryUserRepo = (initialUsers = []) => {
  const users = new Map(initialUsers.map((user) => [user.id, user]));
  const usersByUsername = new Map(initialUsers.map((user) => [user.username, user]));

  return {
    findUserByUsername: async (username) => usersByUsername.get(username) ?? null,
    isUserDisabled: (user) => user?.status === "disabled",
    listUsers: async () => [...users.values()],
    findUserById: async (id) => users.get(id) ?? null
  };
};

const createTestApp = async ({ userRepo, config } = {}) => {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  await app.register(usersRoutes, {
    config: config ?? baseConfig,
    userRepo: userRepo ?? createInMemoryUserRepo()
  });
  await app.ready();
  return app;
};

test("GET /users requires authentication", async () => {
  const app = await createTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/users"
  });

  assert.equal(response.statusCode, 401);
  const body = response.json();
  assert.equal(body.title, "Unauthorized");

  await app.close();
});

test("GET /users forbids non-IT roles", async () => {
  const user = {
    id: "user-1",
    username: "requester",
    role: "requester",
    status: "active"
  };
  const app = await createTestApp({
    userRepo: createInMemoryUserRepo([user])
  });

  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: {
      cookie: await createSessionCookie(user)
    }
  });

  assert.equal(response.statusCode, 403);
  const body = response.json();
  assert.equal(body.title, "Forbidden");

  await app.close();
});

test("GET /users returns list with fields", async () => {
  const orgSyncedAt = new Date("2026-05-13T00:00:00.000Z");
  const orgSnapshot = {
    source: "jkspulse",
    division: { id: "div-1", name: "CORPORATE SERVICES" },
    department: { id: "dept-1", code: "IT", name: "IT" },
    section: { id: "sec-1", name: "INFRASTRUCTURE" },
    matchedBy: "email",
    confidence: "exact"
  };
  const user = {
    id: "user-2",
    username: "it-user",
    role: "it",
    status: "active",
    ldapSyncedAt: new Date("2026-01-28T10:00:00.000Z"),
    orgSyncedAt,
    orgSnapshot,
    ldapAttributes: {
      cn: "Jane Doe",
      mail: "jane@example.com"
    }
  };
  const app = await createTestApp({
    userRepo: createInMemoryUserRepo([user])
  });

  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: {
      cookie: await createSessionCookie(user)
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(Array.isArray(body.data.fields));
  assert.ok(body.data.fields.includes("cn"));
  assert.ok(body.data.fields.includes("mail"));
  assert.ok(body.data.fields.includes("uid"));
  assert.equal(body.data.users.length, 1);
  assert.equal(body.data.users[0].username, "it-user");
  assert.equal(body.data.users[0].ldapFields.cn, "Jane Doe");
  assert.equal(body.data.users[0].ldapFields.department ?? null, null);
  assert.deepEqual(body.data.users[0].orgSnapshot, orgSnapshot);
  assert.equal(body.data.users[0].orgSyncedAt, orgSyncedAt.toISOString());
  assert.ok("ldapSyncedAt" in body.data.users[0]);
  assert.ok(body.data.users[0].ldapSyncedAt);

  await app.close();
});

test("GET /users rejects disabled IT users", async () => {
  const user = {
    id: "user-disabled",
    username: "disabled-it",
    role: "it",
    status: "disabled"
  };
  const app = await createTestApp({
    userRepo: createInMemoryUserRepo([user])
  });

  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: {
      cookie: await createSessionCookie(user)
    }
  });

  assert.equal(response.statusCode, 403);
  const body = response.json();
  assert.equal(body.title, "Account disabled");

  await app.close();
});

test("GET /users filtered response includes Pulse org snapshot", async () => {
  const orgSnapshot = {
    source: "jkspulse",
    department: { id: "dept-1", code: "IT", name: "IT" }
  };
  const user = {
    id: "user-filtered",
    username: "it-user",
    role: "it",
    status: "active"
  };
  const userRepo = {
    ...createInMemoryUserRepo([user]),
    listUsersFiltered: async () => ({
      data: [{
        ...user,
        ldapAttributes: { mail: "it@example.com" },
        ldapSyncedAt: null,
        orgSnapshot,
        orgSyncedAt: new Date("2026-05-13T00:00:00.000Z")
      }],
      total: 1,
      page: 1,
      perPage: 20
    })
  };
  const app = await createTestApp({ userRepo });

  const response = await app.inject({
    method: "GET",
    url: "/users?page=1",
    headers: {
      cookie: await createSessionCookie(user)
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.deepEqual(body.data[0].orgSnapshot, orgSnapshot);
  assert.equal(body.data[0].orgSyncedAt, "2026-05-13T00:00:00.000Z");

  await app.close();
});

test("GET /users/:id returns detail with ldapSyncedAt and 404", async () => {
  const orgSyncedAt = new Date("2026-05-13T00:00:00.000Z");
  const orgSnapshot = {
    source: "jkspulse",
    division: { id: "div-1", name: "CORPORATE SERVICES" },
    department: { id: "dept-1", code: "IT", name: "IT" },
    section: { id: "sec-1", name: "INFRASTRUCTURE" },
    matchedBy: "email",
    confidence: "exact"
  };
  const user = {
    id: "user-3",
    username: "it-user",
    role: "it",
    status: "active",
    ldapSyncedAt: null,
    orgSyncedAt,
    orgSnapshot,
    ldapAttributes: {}
  };
  const app = await createTestApp({
    userRepo: createInMemoryUserRepo([user])
  });

  const cookieHeader = await createSessionCookie(user);
  const okResponse = await app.inject({
    method: "GET",
    url: `/users/${user.id}`,
    headers: {
      cookie: cookieHeader
    }
  });

  assert.equal(okResponse.statusCode, 200);
  const okBody = okResponse.json();
  assert.equal(okBody.data.user.id, user.id);
  assert.ok(okBody.data.fields.includes("uid"));
  assert.ok("ldapSyncedAt" in okBody.data.user);
  assert.deepEqual(okBody.data.user.orgSnapshot, orgSnapshot);
  assert.equal(okBody.data.user.orgSyncedAt, orgSyncedAt.toISOString());

  const missingResponse = await app.inject({
    method: "GET",
    url: "/users/missing",
    headers: {
      cookie: cookieHeader
    }
  });

  assert.equal(missingResponse.statusCode, 404);

  await app.close();
});
