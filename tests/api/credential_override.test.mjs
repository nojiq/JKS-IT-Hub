/* eslint-disable */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import credentialRoutes from "../../apps/api/src/features/credentials/routes.js";
import { CredentialLockedError } from "../../apps/api/src/features/credentials/service.js";
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

const buildApp = async ({ previewError = null, confirmError = null } = {}) => {
    const app = Fastify({ logger: false });
    await app.register(cookie);

    const deletedTokens = [];
    const userRepo = {
        findUserByUsername: async (username) => (username === actor.username ? actor : null),
        isUserDisabled: (user) => user?.status === "disabled"
    };

    const credentialService = {
        previewCredentialOverride: async () => {
            if (previewError) throw previewError;
            return {
                previewToken: "valid-preview-token",
                expiresAt: "2026-02-09T12:05:00.000Z",
                currentCredential: { username: "old.user" },
                proposedCredential: { username: "new.user" },
                changes: { usernameChanged: true, passwordChanged: false },
                reason: "Manual override"
            };
        },
        getPreviewSession: async (token) => {
            if (token !== "valid-preview-token") return null;
            return {
                type: "override",
                userId: "user-1",
                system: "email",
                proposedCredential: { username: "new.user", password: "new-password" },
                currentCredentialId: "cred-1",
                reason: "Manual override",
                changes: { usernameChanged: true, passwordChanged: true }
            };
        },
        confirmCredentialOverride: async () => {
            if (confirmError) throw confirmError;
            return {
                credentialId: "cred-2",
                system: "email",
                overriddenAt: "2026-02-09T12:01:00.000Z",
                overriddenBy: { id: actor.id, username: actor.username },
                historyVersionId: "version-2",
                changes: { usernameChanged: true, passwordChanged: true }
            };
        },
        deletePreviewSession: async (token) => {
            deletedTokens.push(token);
            return true;
        }
    };

    await app.register(credentialRoutes, {
        prefix: "/api/v1/credentials",
        config,
        userRepo,
        credentialService,
        auditRepo: null
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
        deletedTokens,
        authHeader: { cookie: `${config.cookie.name}=${token}` }
    };
};

test("Credential Override API - preview returns locked problem details", async () => {
    const { app, authHeader } = await buildApp({
        previewError: new CredentialLockedError("user-1", "email", {
            lockedAt: "2026-02-09T12:00:00.000Z",
            lockReason: "Freeze"
        })
    });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credentials/users/user-1/email/override/preview",
        headers: authHeader,
        payload: {
            username: "new.user",
            reason: "Manual override requested by IT"
        }
    });

    assert.equal(response.statusCode, 409);
    const body = response.json();
    assert.equal(body.type, "/problems/credential-locked");
    assert.equal(body.title, "Credential Locked");
    assert.equal(body.system, "email");
    assert.equal(body.suggestion, "Unlock the credential first, then retry override.");
    await app.close();
});

test("Credential Override API - confirm returns locked problem details", async () => {
    const { app, authHeader } = await buildApp({
        confirmError: new CredentialLockedError("user-1", "email", {
            lockedAt: "2026-02-09T12:00:00.000Z",
            lockReason: "Freeze"
        })
    });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credentials/users/user-1/email/override/confirm",
        headers: authHeader,
        payload: {
            previewToken: "valid-preview-token",
            confirmed: true
        }
    });

    assert.equal(response.statusCode, 409);
    const body = response.json();
    assert.equal(body.type, "/problems/credential-locked");
    assert.equal(body.title, "Credential Locked");
    assert.equal(body.system, "email");
    await app.close();
});

test("Credential Override API - confirm success does not double-delete preview in route layer", async () => {
    const { app, authHeader, deletedTokens } = await buildApp();

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credentials/users/user-1/email/override/confirm",
        headers: authHeader,
        payload: {
            previewToken: "valid-preview-token",
            confirmed: true
        }
    });

    assert.equal(response.statusCode, 201);
    const body = response.json();
    assert.equal(body.data.credentialId, "cred-2");
    assert.equal(deletedTokens.length, 0);
    await app.close();
});
