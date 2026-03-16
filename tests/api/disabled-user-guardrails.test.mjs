/* eslint-disable */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import credentialRoutes from "../../apps/api/src/features/credentials/routes.js";
import { DisabledUserError } from "../../apps/api/src/features/credentials/service.js";
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

    const auditEntries = [];
    const auditRepo = {
        createAuditLog: async (entry) => {
            auditEntries.push(entry);
            return entry;
        }
    };

    const userRepo = {
        findUserByUsername: async (username) => (username === actor.username ? actor : null),
        isUserDisabled: (user) => user?.status === "disabled"
    };

    const credentialService = {
        generateUserCredentials: async (_actorId, userId) => {
            throw new DisabledUserError(userId);
        },
        previewUserCredentials: async (userId) => {
            throw new DisabledUserError(userId);
        },
        savePreviewedCredentials: async (_actorId, previewSession) => {
            throw new DisabledUserError(previewSession.userId);
        },
        previewCredentialRegeneration: async (userId) => {
            throw new DisabledUserError(userId);
        },
        previewCredentialOverride: async (userId) => {
            throw new DisabledUserError(userId);
        },
        getPreviewSession: async (token) => {
            if (token === "preview-token") {
                return {
                    type: "generation",
                    userId: "disabled-user-id",
                    credentials: [],
                    templateVersion: 1
                };
            }
            if (token === "override-preview-token") {
                return {
                    type: "override",
                    userId: "disabled-user-id",
                    system: "vpn"
                };
            }
            return null;
        },
        confirmCredentialOverride: async () => {
            throw new DisabledUserError("disabled-user-id");
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
        authHeader: { cookie: `${config.cookie.name}=${token}` }
    };
};

test("Disabled User Guardrails - API routes enforce block + audit logs", async (t) => {
    const { app, auditEntries, authHeader } = await buildApp();

    await t.test("POST /users/:id/generate returns RFC 9457 422 + generation blocked audit", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/credentials/users/disabled-user-id/generate",
            headers: authHeader
        });

        assert.equal(response.statusCode, 422);
        const body = response.json();
        assert.equal(body.type, "/problems/disabled-user");
        assert.equal(body.status, 422);
        assert.equal(body.userStatus, "disabled");
        assert.equal(body.suggestion, "Enable the user before generating credentials");

        const latestAudit = auditEntries.at(-1);
        assert.equal(latestAudit.action, "credential.generation.blocked");
        assert.equal(latestAudit.entityId, "disabled-user-id");
        assert.equal(latestAudit.metadata.reason, "user_disabled");
        assert.equal(latestAudit.metadata.attemptedOperation, "generate");
    });

    await t.test("POST /users/:id/preview returns RFC 9457 422 + generation blocked audit", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/credentials/users/disabled-user-id/preview",
            headers: authHeader,
            payload: {}
        });

        assert.equal(response.statusCode, 422);
        const body = response.json();
        assert.equal(body.type, "/problems/disabled-user");
        assert.equal(body.status, 422);
        assert.equal(body.userStatus, "disabled");
        assert.equal(body.suggestion, "Enable the user before generating credentials");

        const latestAudit = auditEntries.at(-1);
        assert.equal(latestAudit.action, "credential.generation.blocked");
        assert.equal(latestAudit.entityId, "disabled-user-id");
        assert.equal(latestAudit.metadata.reason, "user_disabled");
        assert.equal(latestAudit.metadata.attemptedOperation, "generate");
    });

    await t.test("POST /users/:id/confirm returns RFC 9457 422 + generation blocked audit", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/credentials/users/disabled-user-id/confirm",
            headers: authHeader,
            payload: {
                previewToken: "preview-token",
                confirmed: true
            }
        });

        assert.equal(response.statusCode, 422);
        const body = response.json();
        assert.equal(body.type, "/problems/disabled-user");
        assert.equal(body.status, 422);
        assert.equal(body.userStatus, "disabled");
        assert.equal(body.suggestion, "Enable the user before generating credentials");

        const latestAudit = auditEntries.at(-1);
        assert.equal(latestAudit.action, "credential.generation.blocked");
        assert.equal(latestAudit.entityId, "disabled-user-id");
        assert.equal(latestAudit.metadata.reason, "user_disabled");
        assert.equal(latestAudit.metadata.attemptedOperation, "generate");
    });

    await t.test("POST /users/:id/regenerate returns RFC 9457 422 + regeneration blocked audit", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/credentials/users/disabled-user-id/regenerate",
            headers: authHeader,
            payload: {}
        });

        assert.equal(response.statusCode, 422);
        const body = response.json();
        assert.equal(body.type, "/problems/disabled-user");
        assert.equal(body.status, 422);
        assert.equal(body.userStatus, "disabled");

        const latestAudit = auditEntries.at(-1);
        assert.equal(latestAudit.action, "credential.regeneration.blocked");
        assert.equal(latestAudit.entityId, "disabled-user-id");
        assert.equal(latestAudit.metadata.reason, "user_disabled");
        assert.equal(latestAudit.metadata.attemptedOperation, "regenerate");
    });

    await t.test("POST /users/:id/:system/override/preview returns RFC 9457 422 + override blocked audit", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/credentials/users/disabled-user-id/vpn/override/preview",
            headers: authHeader,
            payload: {
                reason: "Need manual override",
                username: "new-user"
            }
        });

        assert.equal(response.statusCode, 422);
        const body = response.json();
        assert.equal(body.type, "/problems/disabled-user");
        assert.equal(body.status, 422);
        assert.equal(body.userStatus, "disabled");

        const latestAudit = auditEntries.at(-1);
        assert.equal(latestAudit.action, "credential.override.blocked");
        assert.equal(latestAudit.entityId, "disabled-user-id");
        assert.equal(latestAudit.metadata.reason, "user_disabled");
        assert.equal(latestAudit.metadata.attemptedOperation, "override");
    });

    await t.test("POST /users/:id/:system/override/confirm returns RFC 9457 422 + override blocked audit", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/credentials/users/disabled-user-id/vpn/override/confirm",
            headers: authHeader,
            payload: {
                previewToken: "override-preview-token",
                confirmed: true
            }
        });

        assert.equal(response.statusCode, 422);
        const body = response.json();
        assert.equal(body.type, "/problems/disabled-user");
        assert.equal(body.status, 422);
        assert.equal(body.userStatus, "disabled");

        const latestAudit = auditEntries.at(-1);
        assert.equal(latestAudit.action, "credential.override.blocked");
        assert.equal(latestAudit.entityId, "disabled-user-id");
        assert.equal(latestAudit.metadata.reason, "user_disabled");
        assert.equal(latestAudit.metadata.attemptedOperation, "override_confirm");
    });

    await app.close();
});
