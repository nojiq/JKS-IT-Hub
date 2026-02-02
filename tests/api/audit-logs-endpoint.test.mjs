import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { createAuditLog, prisma } from "../../apps/api/src/features/audit/repo.js";

after(async () => {
    await prisma.$disconnect();
});
import { createUser } from "../../apps/api/src/features/users/repo.js";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");

import auditRoutes from "../../apps/api/src/features/audit/routes.js";

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

const createTestApp = async ({ userRepo, auditRepo, config } = {}) => {
    const app = Fastify({ logger: false });
    await app.register(cookie);
    await app.register(auditRoutes, {
        config: config ?? baseConfig,
        userRepo: userRepo,
        auditRepo: auditRepo
    });
    await app.ready();
    return app;
};

test("GET /audit-logs returns paginated audit logs", async () => {
    // Create test users
    const actor1 = await createUser({ username: `audit-api-test-actor-1-${randomUUID()}`, role: "it" });

    // Create audit logs
    await createAuditLog({
        action: "test.action.one",
        actorUserId: actor1.id,
        entityType: "test",
        entityId: "1",
        metadata: { test: true }
    });

    const userRepoMock = {
        findUserByUsername: async (username) => {
            if (username === actor1.username) return actor1;
            return null;
        }
    };

    const auditRepoMock = {
        getAuditLogs: async (params) => {
            const { getAuditLogs } = await import("../../apps/api/src/features/audit/repo.js");
            return getAuditLogs(params);
        }
    };

    const app = await createTestApp({ userRepo: userRepoMock, auditRepo: auditRepoMock });

    // Test: Get all logs (paginated)
    const response = await app.inject({
        method: "GET",
        url: "/audit-logs?limit=10",
        headers: {
            cookie: await createSessionCookie(actor1)
        }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(Array.isArray(body.data));
    assert.ok(body.meta);
    assert.equal(body.meta.limit, 10);

    await app.close();
});

test("GET /audit-logs is accessible to non-IT users", async () => {
    const requester = await createUser({ username: `audit-api-test-requester-${randomUUID()}`, role: "requester" });

    const userRepoMock = {
        findUserByUsername: async (username) => {
            if (username === requester.username) return requester;
            return null;
        }
    };

    const auditRepoMock = {
        getAuditLogs: async (params) => {
            const { getAuditLogs } = await import("../../apps/api/src/features/audit/repo.js");
            return getAuditLogs(params);
        }
    };

    const app = await createTestApp({ userRepo: userRepoMock, auditRepo: auditRepoMock });

    const response = await app.inject({
        method: "GET",
        url: "/audit-logs",
        headers: {
            cookie: await createSessionCookie(requester)
        }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(Array.isArray(body.data));

    await app.close();
});

test("GET /audit-logs requires authentication", async () => {
    const userRepoMock = {
        findUserByUsername: async () => null
    };

    const auditRepoMock = {
        getAuditLogs: async () => ({ logs: [], total: 0 })
    };

    const app = await createTestApp({ userRepo: userRepoMock, auditRepo: auditRepoMock });

    const response = await app.inject({
        method: "GET",
        url: "/audit-logs"
    });

    assert.equal(response.statusCode, 401);

    await app.close();
});

test("GET /audit-logs validates pagination parameters", async () => {
    const testUser = await createUser({ username: `audit-edge-test-${randomUUID()}`, role: "it" });

    const userRepoMock = {
        findUserByUsername: async (username) => {
            if (username === testUser.username) return testUser;
            return null;
        }
    };

    const auditRepoMock = {
        getAuditLogs: async () => ({ logs: [], total: 0 })
    };

    const app = await createTestApp({ userRepo: userRepoMock, auditRepo: auditRepoMock });

    // Test: page=0 should fail (must be positive)
    const invalidPage = await app.inject({
        method: "GET",
        url: "/audit-logs?page=0",
        headers: {
            cookie: await createSessionCookie(testUser)
        }
    });
    assert.equal(invalidPage.statusCode, 400);

    // Test: limit=0 should fail (must be positive)
    const invalidLimit = await app.inject({
        method: "GET",
        url: "/audit-logs?limit=0",
        headers: {
            cookie: await createSessionCookie(testUser)
        }
    });
    assert.equal(invalidLimit.statusCode, 400);

    // Test: limit=101 should fail (exceeds max of 100)
    const excessiveLimit = await app.inject({
        method: "GET",
        url: "/audit-logs?limit=101",
        headers: {
            cookie: await createSessionCookie(testUser)
        }
    });
    assert.equal(excessiveLimit.statusCode, 400);

    await app.close();
});

test("GET /audit-logs validates date range", async () => {
    const testUser = await createUser({ username: `audit-date-test-${randomUUID()}`, role: "it" });

    const userRepoMock = {
        findUserByUsername: async (username) => {
            if (username === testUser.username) return testUser;
            return null;
        }
    };

    const auditRepoMock = {
        getAuditLogs: async () => ({ logs: [], total: 0 })
    };

    const app = await createTestApp({ userRepo: userRepoMock, auditRepo: auditRepoMock });

    // Test: endDate before startDate should fail
    const invalidDateRange = await app.inject({
        method: "GET",
        url: "/audit-logs?startDate=2026-01-30T00:00:00Z&endDate=2026-01-01T00:00:00Z",
        headers: {
            cookie: await createSessionCookie(testUser)
        }
    });
    assert.equal(invalidDateRange.statusCode, 400);
    const body = invalidDateRange.json();
    assert.ok(body.detail.includes("endDate"));

    await app.close();
});
