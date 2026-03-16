import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/it_hub_test";

const { default: credentialRoutes } = await import("../../apps/api/src/features/credentials/routes.js");
const {
  CredentialsLockedError,
  DisabledUserError,
  NoChangesDetectedError
} = await import("../../apps/api/src/features/credentials/service.js");
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");

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

const actor = {
  id: "it-actor-1",
  username: "it-actor",
  role: "it",
  status: "active"
};

const buildApp = async () => {
  const app = Fastify({ logger: false });
  await app.register(cookie);

  const previewSessions = new Map();
  const deletedTokens = [];
  const auditEntries = [];

  const userRepo = {
    findUserByUsername: async (username) => (username === actor.username ? actor : null),
    isUserDisabled: (user) => user?.status === "disabled"
  };

  const credentialService = {
    previewCredentialRegeneration: async (userId) => {
      if (userId === "disabled-user-id") {
        throw new DisabledUserError(userId);
      }
      if (userId === "no-changes-user-id") {
        throw new NoChangesDetectedError(userId, "2026-02-09T00:00:00.000Z");
      }
      return {
        userId,
        changeType: "ldap_update",
        changedLdapFields: ["mail"],
        oldTemplateVersion: 1,
        newTemplateVersion: 2,
        comparisons: [
          {
            system: "email",
            old: { username: "old@example.com", password: "old" },
            new: { username: "new@example.com", password: "new" },
            changes: ["username", "password"],
            skipped: false,
            skipReason: null
          }
        ],
        hasLockedCredentials: userId === "locked-user-id",
        lockedCredentials: userId === "locked-user-id"
          ? [{ userId, systemId: "email", reason: "policy_lock" }]
          : []
      };
    },
    storeRegenerationPreview: async (userId, preview) => {
      const token = `regen-test-${userId}`;
      previewSessions.set(token, {
        type: "regeneration",
        userId,
        changeType: preview.changeType,
        newTemplateVersion: preview.newTemplateVersion,
        comparisons: preview.comparisons,
        newCredentials: [{ system: "email", username: "new@example.com", password: "new" }],
        existingCredentialIds: ["cred-1"]
      });
      return token;
    },
    getPreviewSession: async (token) => previewSessions.get(token) ?? null,
    deletePreviewSession: async (token) => {
      deletedTokens.push(token);
      previewSessions.delete(token);
      return true;
    },
    confirmRegeneration: async (performedByUserId, previewSession, options = {}) => {
      if (previewSession.userId === "locked-user-id" && options.skipLocked !== true) {
        throw new CredentialsLockedError([
          {
            userId: "locked-user-id",
            systemId: "email",
            reason: "credential_locked"
          }
        ]);
      }

      return {
        userId: previewSession.userId,
        changeType: previewSession.changeType,
        regeneratedCredentials: [{ system: "email", username: "new@example.com" }],
        preservedHistory: [{ system: "email", previousUsername: "old@example.com" }],
        skippedCredentials: options.skipLocked === true
          ? [{ system: "email", reason: "credential_locked" }]
          : [],
        templateVersion: previewSession.newTemplateVersion,
        forced: options.force === true,
        performedBy: performedByUserId,
        performedAt: "2026-02-10T00:00:00.000Z"
      };
    }
  };

  const auditRepo = {
    createAuditLog: async (entry) => {
      auditEntries.push(entry);
      return entry;
    }
  };

  await app.register(credentialRoutes, {
    prefix: "/api/v1/credentials",
    config,
    userRepo,
    credentialService,
    auditRepo
  });

  const token = await signSessionToken(
    {
      subject: actor.id,
      payload: {
        username: actor.username,
        role: actor.role,
        status: actor.status
      }
    },
    config.jwt
  );

  return {
    app,
    auditEntries,
    deletedTokens,
    authHeader: { cookie: `${config.cookie.name}=${token}` }
  };
};

test("Credential regeneration routes: success + guardrails", async (t) => {
  await t.test("POST /users/:id/regenerate returns preview payload", async () => {
    const { app, authHeader } = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/credentials/users/user-1/regenerate",
      headers: authHeader,
      payload: {}
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.userId, "user-1");
    assert.equal(body.data.changeType, "ldap_update");
    assert.match(body.data.previewToken, /^regen-test-user-1$/);
    assert.ok(Array.isArray(body.data.comparisons));

    await app.close();
  });

  await t.test("POST /users/:id/regenerate returns 422 disabled-user + blocked audit", async () => {
    const { app, authHeader, auditEntries } = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/credentials/users/disabled-user-id/regenerate",
      headers: authHeader,
      payload: {}
    });

    assert.equal(response.statusCode, 422);
    const body = response.json();
    assert.equal(body.type, "/problems/disabled-user");
    assert.equal(body.userStatus, "disabled");

    const latestAudit = auditEntries.at(-1);
    assert.equal(latestAudit.action, "credential.regeneration.blocked");
    assert.equal(latestAudit.metadata.attemptedOperation, "regenerate");

    await app.close();
  });

  await t.test("POST /users/:id/regenerate returns 400 when no changes detected", async () => {
    const { app, authHeader } = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/credentials/users/no-changes-user-id/regenerate",
      headers: authHeader,
      payload: {}
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.type, "/problems/no-changes-detected");

    await app.close();
  });

  await t.test("POST /users/:id/regenerate/confirm requires explicit confirmation", async () => {
    const { app, authHeader } = await buildApp();

    const init = await app.inject({
      method: "POST",
      url: "/api/v1/credentials/users/user-1/regenerate",
      headers: authHeader,
      payload: {}
    });
    const { previewToken } = init.json().data;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/credentials/users/user-1/regenerate/confirm",
      headers: authHeader,
      payload: {
        previewToken,
        confirmed: false
      }
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.title, "Invalid Input");

    await app.close();
  });

  await t.test("POST /users/:id/regenerate/confirm returns 410 for missing preview token", async () => {
    const { app, authHeader } = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/credentials/users/user-1/regenerate/confirm",
      headers: authHeader,
      payload: {
        previewToken: "missing-token",
        confirmed: true,
        acknowledgedWarnings: true
      }
    });

    assert.equal(response.statusCode, 410);
    const body = response.json();
    assert.equal(body.type, "/problems/preview-expired");

    await app.close();
  });

  await t.test("POST /users/:id/regenerate/confirm returns 422 when credentials are locked", async () => {
    const { app, authHeader } = await buildApp();

    const init = await app.inject({
      method: "POST",
      url: "/api/v1/credentials/users/locked-user-id/regenerate",
      headers: authHeader,
      payload: {}
    });
    const { previewToken } = init.json().data;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/credentials/users/locked-user-id/regenerate/confirm",
      headers: authHeader,
      payload: {
        previewToken,
        confirmed: true,
        acknowledgedWarnings: true,
        skipLocked: false
      }
    });

    assert.equal(response.statusCode, 422);
    const body = response.json();
    assert.equal(body.type, "/problems/credentials-locked");

    await app.close();
  });

  await t.test("POST /users/:id/regenerate/confirm returns 201 and clears preview", async () => {
    const { app, authHeader, deletedTokens, auditEntries } = await buildApp();

    const init = await app.inject({
      method: "POST",
      url: "/api/v1/credentials/users/user-1/regenerate",
      headers: authHeader,
      payload: {}
    });
    const { previewToken } = init.json().data;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/credentials/users/user-1/regenerate/confirm",
      headers: authHeader,
      payload: {
        previewToken,
        confirmed: true,
        acknowledgedWarnings: true,
        skipLocked: true
      }
    });

    assert.equal(response.statusCode, 201);
    const body = response.json();
    assert.equal(body.data.userId, "user-1");
    assert.ok(Array.isArray(body.data.regeneratedCredentials));
    assert.ok(deletedTokens.includes(previewToken));

    const latestAudit = auditEntries.at(-1);
    assert.equal(latestAudit.action, "credentials.regenerate.confirm");

    await app.close();
  });
});
