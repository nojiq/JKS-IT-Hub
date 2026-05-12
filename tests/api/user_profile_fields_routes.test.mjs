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

const createUserRepo = (initialUsers = []) => {
  const users = new Map(initialUsers.map((user) => [user.id, user]));
  const usersByUsername = new Map(initialUsers.map((user) => [user.username, user]));

  return {
    findUserByUsername: async (username) => usersByUsername.get(username) ?? null,
    findUserById: async (id) => users.get(id) ?? null,
    isUserDisabled: (user) => user?.status === "disabled"
  };
};

const createAuditRepo = () => {
  const logs = [];
  return {
    createAuditLog: async (log) => {
      logs.push(log);
      return log;
    },
    getLogs: () => logs
  };
};

const createTestApp = async ({ users, userFieldRepo, auditRepo } = {}) => {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  await app.register(usersRoutes, {
    config: baseConfig,
    userRepo: createUserRepo(users),
    userFieldRepo,
    auditRepo: auditRepo ?? createAuditRepo()
  });
  await app.ready();
  return app;
};

test("GET /users/:id includes dynamic profile fields", async () => {
  const actor = { id: "it-1", username: "it-user", role: "it", status: "active" };
  const target = {
    id: "user-1",
    username: "abdullah.fauzi",
    role: "requester",
    status: "active",
    ldapSyncedAt: new Date("2026-05-12T04:00:00.000Z"),
    ldapAttributes: { cn: "Abdullah Fauzi", mail: "abdullah.fauzi@jkseng.com" }
  };
  const userFieldRepo = {
    listProfileFieldsForUser: async (userId) => {
      assert.equal(userId, target.id);
      return [
        {
          key: "name",
          label: "Name",
          type: "text",
          required: true,
          sensitive: false,
          value: "Abdullah Fauzi",
          source: "manual"
        },
        {
          key: "actual-password",
          label: "Actual Password",
          type: "password",
          required: false,
          sensitive: true,
          value: "Secret123!",
          source: "manual"
        }
      ];
    }
  };
  const app = await createTestApp({ users: [actor, target], userFieldRepo });

  const response = await app.inject({
    method: "GET",
    url: `/users/${target.id}`,
    headers: {
      cookie: await createSessionCookie(actor)
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.data.user.profileFields.length, 2);
  assert.deepEqual(body.data.user.profileFields.map((field) => field.key), ["name", "actual-password"]);
  assert.equal(body.data.user.profileFields[0].value, "Abdullah Fauzi");
  assert.equal(body.data.user.profileFields[1].value, "Secret123!");

  await app.close();
});

test("PATCH /users/:id/profile-fields allows IT to update profile fields", async () => {
  const actor = { id: "it-1", username: "it-user", role: "it", status: "active" };
  const target = { id: "user-1", username: "abdullah.fauzi", role: "requester", status: "active" };
  const auditRepo = createAuditRepo();
  const userFieldRepo = {
    updateProfileFieldValues: async ({ userId, values, updatedBy }) => {
      assert.equal(userId, target.id);
      assert.equal(updatedBy, actor.id);
      assert.deepEqual(values, {
        name: "Abdullah Fauzi",
        "actual-password": "Secret123!"
      });
      return [
        {
          key: "name",
          label: "Name",
          type: "text",
          required: true,
          sensitive: false,
          value: "Abdullah Fauzi",
          source: "manual"
        },
        {
          key: "actual-password",
          label: "Actual Password",
          type: "password",
          required: false,
          sensitive: true,
          value: "Secret123!",
          source: "manual"
        }
      ];
    }
  };
  const app = await createTestApp({ users: [actor, target], userFieldRepo, auditRepo });

  const response = await app.inject({
    method: "PATCH",
    url: `/users/${target.id}/profile-fields`,
    headers: {
      cookie: await createSessionCookie(actor)
    },
    payload: {
      values: {
        name: "Abdullah Fauzi",
        "actual-password": "Secret123!"
      }
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.data.profileFields.length, 2);
  assert.equal(auditRepo.getLogs().length, 1);
  assert.equal(auditRepo.getLogs()[0].action, "user.profile_fields_update");

  await app.close();
});

test("PATCH /users/:id/profile-fields rejects requester role", async () => {
  const actor = { id: "requester-1", username: "requester", role: "requester", status: "active" };
  const target = { id: "user-1", username: "abdullah.fauzi", role: "requester", status: "active" };
  const app = await createTestApp({
    users: [actor, target],
    userFieldRepo: {
      listProfileFieldsForUser: async () => [],
      updateProfileFieldValues: async () => {
        throw new Error("should not update profile fields for requester");
      }
    }
  });

  const response = await app.inject({
    method: "PATCH",
    url: `/users/${target.id}/profile-fields`,
    headers: {
      cookie: await createSessionCookie(actor)
    },
    payload: {
      values: {
        name: "Abdullah Fauzi"
      }
    }
  });

  assert.equal(response.statusCode, 403);

  await app.close();
});
