
/**
 * Batch Credential Export API Integration Tests
 * 
 * Tests for Story 3.2: Batch Credential Export
 */

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { prisma } from "../../apps/api/src/features/audit/repo.js";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";
import exportRoutes from "../../apps/api/src/features/exports/routes.js";

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

const createTestApp = async ({ config = baseConfig, userRepoOverride } = {}) => {
    const app = Fastify({ logger: false });

    await app.register(cookie);

    const userRepo = userRepoOverride || {
        findUserByUsername: async (username) => null,
        findUserById: async (id) => null
    };

    await app.register(exportRoutes, {
        prefix: '/api/v1',
        config,
        userRepo
    });

    return app;
};

after(async () => {
    await prisma.$disconnect();
});

test.describe('Batch Credential Export API', () => {
    let app;
    let testItUser;
    let testRequesterUser;
    let itSessionCookie;
    let requesterSessionCookie;
    let testUsers = [];

    test.before(async () => {
        const userRepo = {
            findUserByUsername: async (username) => {
                return testUsers.find(u => u.username === username);
            },
            findUserById: async (id) => {
                return testUsers.find(u => u.id === id);
            }
        };

        app = await createTestApp({ userRepoOverride: userRepo });

        testItUser = await prisma.user.create({
            data: {
                username: `batch-api-it-${randomUUID()}`,
                role: 'it',
                status: 'active'
            }
        });

        testRequesterUser = await prisma.user.create({
            data: {
                username: `batch-api-req-${randomUUID()}`,
                role: 'requester',
                status: 'active'
            }
        });

        testUsers = [testItUser, testRequesterUser];

        itSessionCookie = await createSessionCookie(testItUser);
        requesterSessionCookie = await createSessionCookie(testRequesterUser);
    });

    test.after(async () => {
        await prisma.user.deleteMany({ where: { id: { in: testUsers.map(u => u.id) } } });
    });

    test('should return 401 for unauthenticated request', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/credentials/export/batch',
            body: { userIds: [testRequesterUser.id] }
        });

        assert.strictEqual(response.statusCode, 401);
    });

    test('should return 403 for non-IT user', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/credentials/export/batch',
            headers: {
                cookie: requesterSessionCookie
            },
            body: { userIds: [testRequesterUser.id] }
        });

        assert.strictEqual(response.statusCode, 403);
    });

    test('should return 400 for invalid body', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/credentials/export/batch',
            headers: {
                cookie: itSessionCookie
            },
            body: { userIds: [] } // Min 1
        });

        assert.strictEqual(response.statusCode, 400);
    });

    test('should return 400 with guidance when batch size exceeds 100 users', async () => {
        const oversizedUserIds = Array.from({ length: 101 }, () => randomUUID());
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/credentials/export/batch',
            headers: {
                cookie: itSessionCookie
            },
            body: { userIds: oversizedUserIds }
        });

        assert.strictEqual(response.statusCode, 400);
        const body = response.json();
        assert.match(body.detail, /limited to 100 users/i);
        assert.match(body.suggestion, /break.*smaller batches/i);
        assert.strictEqual(body.requestedSize, 101);
        assert.strictEqual(body.maxSize, 100);
    });

    test('should return 200 and export content for valid request', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/credentials/export/batch',
            headers: {
                cookie: itSessionCookie
            },
            body: { userIds: [testRequesterUser.id] }
        });

        assert.strictEqual(response.statusCode, 200);
        assert.ok(response.headers['content-type'].includes('text/plain'));
        assert.ok(response.headers['content-disposition'].includes('attachment'));

        const body = response.body;
        assert.ok(body.includes('IT-HUB BATCH CREDENTIAL EXPORT'));
        assert.ok(body.includes('Successful Exports: 0')); // No creds yet
        assert.ok(body.includes('Skipped Users: 1')); // No exportable creds
        assert.ok(body.includes('Reason: No exportable credentials'));
    });
});
