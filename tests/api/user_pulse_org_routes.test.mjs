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
    findUserById: async (id) => users.get(id) ?? null,
    findUserByUsername: async (username) => usersByUsername.get(username) ?? null,
    updateUserOrgSnapshot: async (id, orgSnapshot) => {
      const prev = users.get(id);
      if (!prev) {
        return null;
      }
      const next = { ...prev, orgSnapshot, orgSyncedAt: new Date("2026-05-14T12:00:00.000Z") };
      users.set(id, next);
      return next;
    }
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

const createTestApp = async ({ users, auditRepo } = {}) => {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  await app.register(usersRoutes, {
    config: baseConfig,
    userRepo: createUserRepo(users),
    auditRepo: auditRepo ?? createAuditRepo()
  });
  await app.ready();
  return app;
};

test("PATCH /users/:id/pulse-org updates org snapshot for IT user", async () => {
  const actor = { id: "it-1", username: "it-user", role: "it", status: "active" };
  const target = {
    id: "user-1",
    username: "abdullah.fauzi",
    role: "requester",
    status: "active",
    ldapSyncedAt: new Date("2026-05-12T04:00:00.000Z"),
    ldapAttributes: { mail: "abdullah.fauzi@jkseng.com" },
    orgSnapshot: {
      source: "jkspulse",
      division: { id: "div-old", name: "OLD DIV" },
      department: { id: "dept-old", name: "OLD DEPT" },
      section: null,
      matchedBy: "email",
      confidence: "exact"
    },
    orgSyncedAt: new Date("2026-05-01T00:00:00.000Z")
  };
  const auditRepo = createAuditRepo();
  const app = await createTestApp({ users: [actor, target], auditRepo });
  const cookieHeader = await createSessionCookie(actor);

  const response = await app.inject({
    method: "PATCH",
    url: `/users/${target.id}/pulse-org`,
    headers: { cookie: cookieHeader },
    payload: {
      pulseOrg: {
        division: { id: "div-1", name: "MANUFACTURING" },
        department: { id: "dept-1", name: "ENGINEERING" },
        section: { id: "sec-1", name: "AUTOMATION" }
      }
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.data.user.orgSnapshot.source, "jkspulse");
  assert.equal(body.data.user.orgSnapshot.matchedBy, "manual");
  assert.equal(body.data.user.orgSnapshot.division.name, "MANUFACTURING");
  assert.equal(body.data.user.orgSnapshot.department.name, "ENGINEERING");
  assert.equal(body.data.user.orgSnapshot.section.name, "AUTOMATION");

  const logs = auditRepo.getLogs();
  assert.equal(logs.some((l) => l.action === "user.pulse_org_update"), true);

  await app.close();
});
