import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");

import assetsRoutes from "../../apps/api/src/features/assets/routes.js";
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
  { id: "00000000-0000-4000-8000-000000000001", username: "requester", role: "requester", status: "active" },
  { id: "00000000-0000-4000-8000-000000000002", username: "it.user", role: "it", status: "active" }
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

const buildApp = async ({ assetService }) => {
  const app = Fastify({ logger: false });
  const userRepo = {
    findUserByUsername: async (username) => users.find((user) => user.username === username) ?? null,
    findUserById: async (id) => users.find((user) => user.id === id) ?? null,
    isUserDisabled: (user) => user?.status === "disabled"
  };
  await app.register(cookie);
  await app.register(assetsRoutes, {
    config,
    userRepo,
    assetService,
    auditRepo: { createAuditLog: async () => ({}) }
  });
  await app.ready();
  return app;
};

test("requester can list assets", async () => {
  const assetService = {
    listAssets: async (filters, pagination) => ({
      data: [{ id: "asset-1", assetTag: "LAP001", assignmentSource: "auto_username" }],
      total: 1,
      page: pagination.page,
      perPage: pagination.perPage
    }),
    getSyncStatus: async () => ({ configured: true, latestRun: null }),
    isConfigured: () => true,
    isEnabled: () => true
  };
  const app = await buildApp({ assetService });

  const response = await app.inject({
    method: "GET",
    url: "/?search=LAP&page=1&perPage=20",
    headers: { cookie: await createSessionCookie(users[0]) }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.data[0].assetTag, "LAP001");
  assert.equal(body.meta.total, 1);

  await app.close();
});

test("requester cannot trigger asset sync", async () => {
  const assetService = {
    isConfigured: () => true,
    isEnabled: () => true,
    syncAssets: async () => ({ fetchedCount: 1 })
  };
  const app = await buildApp({ assetService });

  const response = await app.inject({
    method: "POST",
    url: "/sync",
    headers: { cookie: await createSessionCookie(users[0]) }
  });

  assert.equal(response.statusCode, 403);

  await app.close();
});

test("IT user can trigger asset sync", async () => {
  const assetService = {
    isConfigured: () => true,
    isEnabled: () => true,
    syncAssets: async () => ({ fetchedCount: 1, upsertedCount: 1, matchedCount: 1, unmatchedCount: 0 })
  };
  const app = await buildApp({ assetService });

  const response = await app.inject({
    method: "POST",
    url: "/sync",
    headers: { cookie: await createSessionCookie(users[1]) }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.fetchedCount, 1);

  await app.close();
});

test("IT user can manually link asset to user", async () => {
  const assetService = {
    linkAssetToUser: async (assetId, userId) => ({
      id: assetId,
      assignedToUserId: userId,
      assignmentSource: "manual"
    })
  };
  const app = await buildApp({ assetService });

  const response = await app.inject({
    method: "PATCH",
    url: "/asset-1/link-user",
    headers: { cookie: await createSessionCookie(users[1]) },
    payload: { userId: users[0].id }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.assignmentSource, "manual");

  await app.close();
});
