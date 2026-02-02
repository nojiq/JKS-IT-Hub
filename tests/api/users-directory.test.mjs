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
  const user = {
    id: "user-2",
    username: "it-user",
    role: "it",
    status: "active",
    ldapSyncedAt: new Date("2026-01-28T10:00:00.000Z"),
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

test("GET /users/:id returns detail with ldapSyncedAt and 404", async () => {
  const user = {
    id: "user-3",
    username: "it-user",
    role: "it",
    status: "active",
    ldapSyncedAt: null,
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
