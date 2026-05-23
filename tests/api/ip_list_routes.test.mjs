import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");

import ipListRoutes from "../../apps/api/src/features/ip-list/routes.js";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";

const config = {
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
  }
};

const users = [
  { id: "00000000-0000-4000-8000-000000000001", username: "dev.user", role: "dev", status: "active" }
];

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
    config.jwt
  );
  return `${config.cookie.name}=${token}`;
};

const buildApp = async ({ ipListService, auditRepo = { createAuditLog: async () => ({}) } }) => {
  const app = Fastify({ logger: false });
  const userRepo = {
    findUserByUsername: async (username) => users.find((user) => user.username === username) ?? null,
    findUserById: async (id) => users.find((user) => user.id === id) ?? null,
    isUserDisabled: (user) => user?.status === "disabled"
  };
  await app.register(cookie);
  await app.register(ipListRoutes, {
    config,
    userRepo,
    ipListService,
    auditRepo
  });
  await app.ready();
  return app;
};

test("authenticated app user can create manual IP record", async () => {
  const auditLogs = [];
  const app = await buildApp({
    ipListService: {
      createManualRecord: async (payload, actor) => ({
        id: "manual-1",
        ...payload,
        source: "manual",
        createdByUserId: actor.id
      })
    },
    auditRepo: { createAuditLog: async (entry) => auditLogs.push(entry) }
  });

  const response = await app.inject({
    method: "POST",
    url: "/manual-records",
    headers: { cookie: await createSessionCookie(users[0]) },
    payload: {
      ipAddress: "192.168.28.20",
      hostname: "Printer L1",
      location: "Level 1",
      department: "Admin",
      macAddress: "AA:BB:CC:DD:EE:20",
      notes: "Manual"
    }
  });

  assert.equal(response.statusCode, 201, response.body);
  assert.equal(response.json().data.ipAddress, "192.168.28.20");
  assert.equal(auditLogs[0].action, "ip_list.manual.create");

  await app.close();
});

test("manual IP duplicate returns 409 with redirect target", async () => {
  const duplicate = new Error("IP address already exists");
  duplicate.statusCode = 409;
  duplicate.existing = { source: "asset", id: "asset-1", ipAddress: "192.168.78.15" };
  duplicate.redirectTo = "/ip-list/192.168.78.15";

  const app = await buildApp({
    ipListService: {
      createManualRecord: async () => {
        throw duplicate;
      }
    }
  });

  const response = await app.inject({
    method: "POST",
    url: "/manual-records",
    headers: { cookie: await createSessionCookie(users[0]) },
    payload: { ipAddress: "192.168.78.15", hostname: "Duplicate" }
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().existing.id, "asset-1");
  assert.equal(response.json().redirectTo, "/ip-list/192.168.78.15");

  await app.close();
});

test("authenticated app user can create subnet rule", async () => {
  const app = await buildApp({
    ipListService: {
      createSubnetRule: async (payload) => ({
        id: "subnet-1",
        cidr: payload.cidr,
        networkAddress: "192.168.78.0",
        prefixLength: 24,
        purpose: payload.purpose,
        description: payload.description ?? null
      })
    }
  });

  const response = await app.inject({
    method: "POST",
    url: "/subnets",
    headers: { cookie: await createSessionCookie(users[0]) },
    payload: { cidr: "192.168.78.0/24", purpose: "Server" }
  });

  assert.equal(response.statusCode, 201, response.body);
  assert.equal(response.json().data.purpose, "Server");

  await app.close();
});
