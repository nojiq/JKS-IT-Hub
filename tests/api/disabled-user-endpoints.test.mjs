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
        previewUserCredentials: async (userId) => {
            throw new DisabledUserError(userId);
        },
        savePreviewedCredentials: async (_actorId, previewSession) => {
            throw new DisabledUserError(previewSession.userId);
        },
        previewCredentialRegeneration: async (userId) => {
            throw new DisabledUserError(userId);
        },
        confirmRegeneration: async () => {
            throw new DisabledUserError("disabled-user-id");
        },
        previewCredentialOverride: async (userId) => {
            throw new DisabledUserError(userId);
        },
        confirmCredentialOverride: async () => {
            throw new DisabledUserError("disabled-user-id");
        },
        getPreviewSession: async (token) => {
            if (token === "generate-preview-token") {
                return {
                    type: "generation",
                    userId: "disabled-user-id",
                    credentials: [],
                    templateVersion: 1
                };
            }
            if (token === "invalid-type-preview-token") {
                return {
                    type: "override",
                    userId: "disabled-user-id",
                    system: "vpn"
                };
            }
            if (token === "regen-preview-token") {
                return {
                    type: "regeneration",
                    userId: "disabled-user-id"
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

const assertDisabledProblem = (responseBody) => {
    assert.equal(responseBody.type, "/problems/disabled-user");
    assert.equal(responseBody.status, 422);
    assert.equal(responseBody.title, "Disabled User");
    assert.equal(responseBody.userStatus, "disabled");
};

test("Disabled User Endpoints - use RFC 9457 disabled-user response", async (t) => {
    const { app, auditEntries, authHeader } = await buildApp();

    await t.test("POST /users/:id/preview returns 422 disabled-user", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/credentials/users/disabled-user-id/preview",
            headers: authHeader,
            payload: {}
        });

        assert.equal(response.statusCode, 422);
        const body = response.json();
        assertDisabledProblem(body);
        assert.equal(body.suggestion, "Enable the user before generating credentials");

        const latestAudit = auditEntries.at(-1);
        assert.equal(latestAudit.action, "credential.generation.blocked");
        assert.equal(latestAudit.metadata.attemptedOperation, "generate");
    });

    await t.test("POST /users/:id/confirm returns 422 disabled-user", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/credentials/users/disabled-user-id/confirm",
            headers: authHeader,
            payload: {
                previewToken: "generate-preview-token",
                confirmed: true
            }
        });

        assert.equal(response.statusCode, 422);
        const body = response.json();
        assertDisabledProblem(body);

        const latestAudit = auditEntries.at(-1);
        assert.equal(latestAudit.action, "credential.generation.blocked");
        assert.equal(latestAudit.metadata.attemptedOperation, "generate");
    });

    await t.test("POST /users/:id/confirm rejects non-generation preview token", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/credentials/users/disabled-user-id/confirm",
            headers: authHeader,
            payload: {
                previewToken: "invalid-type-preview-token",
                confirmed: true
            }
        });

        assert.equal(response.statusCode, 400);
        const body = response.json();
        assert.equal(body.title, "Invalid Preview Token");
    });

    await t.test("POST /users/:id/regenerate/preview returns 422 disabled-user", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/credentials/users/disabled-user-id/regenerate/preview",
            headers: authHeader,
            payload: {}
        });

        assert.equal(response.statusCode, 422);
        const body = response.json();
        assertDisabledProblem(body);

        const latestAudit = auditEntries.at(-1);
        assert.equal(latestAudit.action, "credential.regeneration.blocked");
        assert.equal(latestAudit.metadata.attemptedOperation, "regenerate");
    });

    await t.test("POST /users/:id/regenerate/confirm returns 422 disabled-user", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/credentials/users/disabled-user-id/regenerate/confirm",
            headers: authHeader,
            payload: {
                previewToken: "regen-preview-token",
                confirmed: true
            }
        });

        assert.equal(response.statusCode, 422);
        const body = response.json();
        assertDisabledProblem(body);

        const latestAudit = auditEntries.at(-1);
        assert.equal(latestAudit.action, "credential.regeneration.blocked");
        assert.equal(latestAudit.metadata.attemptedOperation, "regenerate");
    });

    await t.test("POST /users/:id/:system/override/preview returns 422 disabled-user", async () => {
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
        assertDisabledProblem(body);

        const latestAudit = auditEntries.at(-1);
        assert.equal(latestAudit.action, "credential.override.blocked");
        assert.equal(latestAudit.metadata.attemptedOperation, "override");
    });

    await t.test("POST /users/:id/:system/override/confirm returns 422 disabled-user", async () => {
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
        assertDisabledProblem(body);

        const latestAudit = auditEntries.at(-1);
        assert.equal(latestAudit.action, "credential.override.blocked");
        assert.equal(latestAudit.metadata.attemptedOperation, "override_confirm");
    });

    await app.close();
});
