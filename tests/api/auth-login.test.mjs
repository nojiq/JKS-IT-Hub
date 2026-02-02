import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");
import authRoutes from "../../apps/api/src/features/auth/routes.js";
import { LdapInvalidCredentialsError } from "../../apps/api/src/features/ldap/service.js";
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
  cors: {
    origin: "http://localhost:5173"
  }
};

const createTestApp = async ({ ldapService, userRepo }) => {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  await app.register(authRoutes, {
    config: baseConfig,
    ldapAuthFn: ldapService.authenticate,
    userRepo
  });
  await app.ready();
  return app;
};

const createInMemoryUserRepo = (initialUsers = []) => {
  let nextId = initialUsers.length + 1;
  const normalizeUser = (user) => ({
    ...user,
    id: String(user.id ?? `user-${nextId++}`)
  });
  const users = new Map(initialUsers.map((user) => {
    const normalized = normalizeUser(user);
    return [normalized.username, normalized];
  }));

  return {
    findOrCreateUser: async ({ username, role = "requester" }) => {
      const existing = users.get(username);
      if (existing) {
        return existing;
      }
      const user = {
        id: `user-${nextId++}`,
        username,
        role,
        status: "active"
      };
      users.set(username, user);
      return user;
    },
    findUserByUsername: async (username) => users.get(username) ?? null,
    isUserDisabled: (user) => user?.status === "disabled"
  };
};

test("POST /auth/login returns session cookie on success", async () => {
  const ldapService = {
    authenticate: async () => ({ dn: "uid=jane,dc=example,dc=com" })
  };
  const userRepo = createInMemoryUserRepo();
  const app = await createTestApp({ ldapService, userRepo });

  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { username: "jane", password: "secret" }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.data.user.username, "jane");
  const setCookie = response.headers["set-cookie"] ?? "";
  assert.ok(setCookie.includes(baseConfig.cookie.name));
  assert.ok(setCookie.includes("HttpOnly"));
  assert.ok(setCookie.includes("Secure"));
  assert.ok(setCookie.includes("SameSite=Lax"));

  await app.close();
});

test("POST /auth/login rejects invalid LDAP credentials", async () => {
  const ldapService = {
    authenticate: async () => {
      throw new LdapInvalidCredentialsError();
    }
  };
  const userRepo = createInMemoryUserRepo();
  const app = await createTestApp({ ldapService, userRepo });

  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { username: "jane", password: "wrong" }
  });

  assert.equal(response.statusCode, 401);
  const body = response.json();
  assert.equal(body.title, "Invalid Credentials");

  await app.close();
});

test("POST /auth/login blocks disabled users", async () => {
  const ldapService = {
    authenticate: async () => ({ dn: "uid=disabled,dc=example,dc=com" })
  };
  const userRepo = createInMemoryUserRepo([
    { id: "user-3", username: "disabled", role: "requester", status: "disabled" }
  ]);
  const app = await createTestApp({ ldapService, userRepo });

  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { username: "disabled", password: "secret" }
  });

  assert.equal(response.statusCode, 403);
  const body = response.json();
  assert.equal(body.title, "Account Disabled");

  await app.close();
});

test("GET /auth/me returns the session user when active", async () => {
  const user = { id: "user-10", username: "jane", role: "requester", status: "active" };
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
  const app = await createTestApp({
    ldapService: { authenticate: async () => ({ dn: "uid=jane,dc=example,dc=com" }) },
    userRepo: createInMemoryUserRepo([user])
  });

  const response = await app.inject({
    method: "GET",
    url: "/auth/me",
    headers: {
      cookie: `${baseConfig.cookie.name}=${token}`
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.data.user.id, user.id);
  assert.equal(body.data.user.status, "active");

  await app.close();
});

test("GET /auth/me blocks disabled users even with a valid token", async () => {
  const user = { id: "user-11", username: "blocked", role: "requester", status: "disabled" };
  const token = await signSessionToken(
    {
      subject: user.id,
      payload: {
        username: user.username,
        role: user.role,
        status: "active"
      }
    },
    baseConfig.jwt
  );
  const app = await createTestApp({
    ldapService: { authenticate: async () => ({ dn: "uid=blocked,dc=example,dc=com" }) },
    userRepo: createInMemoryUserRepo([user])
  });

  const response = await app.inject({
    method: "GET",
    url: "/auth/me",
    headers: {
      cookie: `${baseConfig.cookie.name}=${token}`
    }
  });

  assert.equal(response.statusCode, 403);
  const body = response.json();
  assert.equal(body.title, "Account Disabled");

  await app.close();
});
