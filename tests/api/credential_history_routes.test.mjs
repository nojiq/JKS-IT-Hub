import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/it_hub_test";

const { default: credentialRoutes } = await import("../../apps/api/src/features/credentials/routes.js");
const { signSessionToken } = await import("../../apps/api/src/shared/auth/jwt.js");

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");

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

const createTestApp = async ({ credentialService, userRepo, auditRepo } = {}) => {
    const app = Fastify({ logger: false });
    await app.register(cookie);
    await app.register(credentialRoutes, {
        prefix: "/api/v1/credential-templates",
        config: baseConfig,
        credentialService,
        userRepo,
        auditRepo
    });
    await app.ready();
    return app;
};

test("GET /users/:userId/history rejects non-IT roles", async () => {
    const requester = {
        id: randomUUID(),
        username: "requester.user",
        role: "requester",
        status: "active"
    };

    const userRepo = {
        findUserByUsername: async (username) => (username === requester.username ? requester : null)
    };

    const app = await createTestApp({
        credentialService: {
            getCredentialHistory: async () => ({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } })
        },
        userRepo
    });

    const response = await app.inject({
        method: "GET",
        url: `/api/v1/credential-templates/users/${randomUUID()}/history`,
        headers: { cookie: await createSessionCookie(requester) }
    });

    assert.equal(response.statusCode, 403);
    const body = response.json();
    assert.equal(body.title, "Forbidden");

    await app.close();
});

test("GET /users/:userId/history validates query parameters", async () => {
    const itUser = {
        id: randomUUID(),
        username: "it.user",
        role: "it",
        status: "active"
    };

    const userRepo = {
        findUserByUsername: async (username) => (username === itUser.username ? itUser : null)
    };

    const app = await createTestApp({
        credentialService: {
            getCredentialHistory: async () => ({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } })
        },
        userRepo
    });

    const response = await app.inject({
        method: "GET",
        url: `/api/v1/credential-templates/users/${randomUUID()}/history?startDate=2026-02-11T00:00:00.000Z&endDate=2026-02-10T00:00:00.000Z`,
        headers: { cookie: await createSessionCookie(itUser) }
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.title, "Invalid Query Parameters");

    await app.close();
});

test("GET /users/:userId/history returns data and writes audit log", async () => {
    const itUser = {
        id: randomUUID(),
        username: "it.auditor",
        role: "it",
        status: "active"
    };
    const targetUserId = randomUUID();

    const userRepo = {
        findUserByUsername: async (username) => (username === itUser.username ? itUser : null)
    };

    const historyResult = {
        data: [
            {
                id: randomUUID(),
                userId: targetUserId,
                system: "email",
                username: "john.doe",
                password: { masked: "••••••••", revealed: null },
                reason: "initial",
                reasonLabel: "Initial Generation",
                timestamp: "2026-02-10T09:00:00.000Z",
                createdBy: { id: itUser.id, name: itUser.username },
                templateVersion: 2,
                ldapFields: [],
                isCurrent: false
            }
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
    };

    const auditCalls = [];
    const app = await createTestApp({
        credentialService: {
            getCredentialHistory: async (_userId, filters) => {
                assert.equal(filters.system, "email");
                return historyResult;
            }
        },
        userRepo,
        auditRepo: {
            createAuditLog: async (payload) => {
                auditCalls.push(payload);
            }
        }
    });

    const response = await app.inject({
        method: "GET",
        url: `/api/v1/credential-templates/users/${targetUserId}/history?system=email&page=1&limit=20`,
        headers: { cookie: await createSessionCookie(itUser) }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.length, 1);
    assert.equal(body.meta.total, 1);

    assert.equal(auditCalls.length, 1);
    assert.equal(auditCalls[0].action, "credentials.history.list");
    assert.equal(auditCalls[0].entityId, targetUserId);

    await app.close();
});

test("POST /versions/compare validates distinct UUID inputs", async () => {
    const itUser = {
        id: randomUUID(),
        username: "it.compare",
        role: "it",
        status: "active"
    };

    const userRepo = {
        findUserByUsername: async (username) => (username === itUser.username ? itUser : null)
    };

    const app = await createTestApp({
        credentialService: {
            compareCredentialVersions: async () => ({ differences: [], system: "email", timeGap: "0 seconds" })
        },
        userRepo
    });

    const sameVersionId = randomUUID();
    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credential-templates/versions/compare",
        headers: {
            cookie: await createSessionCookie(itUser),
            "content-type": "application/json"
        },
        payload: { versionId1: sameVersionId, versionId2: sameVersionId }
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.title, "Invalid Input");

    await app.close();
});
