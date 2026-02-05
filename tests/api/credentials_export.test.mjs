/**
 * Credential Export API Integration Tests
 * 
 * Tests for Story 3.1: Single-User Credential Export
 * - Export API endpoint works correctly
 * - IT role required for export
 * - Proper error handling and responses
 * - IMAP credentials excluded from export
 */

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { prisma } from "../../apps/api/src/features/audit/repo.js";
import { createUser } from "../../apps/api/src/features/users/repo.js";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");

import exportRoutes from "../../apps/api/src/features/exports/routes.js";

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

    app.get('/health', async () => ({ status: 'ok' }));

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

test.describe('Credential Export API Integration', () => {
    let app;
    let testItUser;
    let testRequesterUser;
    let testDisabledUser;
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
                username: `test-it-${randomUUID()}`,
                role: 'it',
                status: 'active',
                ldapAttributes: { mail: 'test-it@example.com' }
            }
        });

        testRequesterUser = await prisma.user.create({
            data: {
                username: `test-requester-${randomUUID()}`,
                role: 'requester',
                status: 'active',
                ldapAttributes: { mail: 'test-requester@example.com' }
            }
        });

        testDisabledUser = await prisma.user.create({
            data: {
                username: `test-disabled-${randomUUID()}`,
                role: 'it',
                status: 'disabled',
                ldapAttributes: { mail: 'test-disabled@example.com' }
            }
        });

        testUsers = [testItUser, testRequesterUser, testDisabledUser];

        itSessionCookie = await createSessionCookie(testItUser);
        requesterSessionCookie = await createSessionCookie(testRequesterUser);
    });

    test('should return 401 for unauthenticated request', async () => {
        const userId = randomUUID();
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/users/${userId}/credentials/export`
        });

        assert.strictEqual(response.statusCode, 401);
    });

    test('should return 403 for non-IT user', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/users/${testRequesterUser.id}/credentials/export`,
            headers: {
                cookie: requesterSessionCookie
            }
        });

        assert.strictEqual(response.statusCode, 403);
        const result = response.json();
        assert.strictEqual(result.title, 'Unauthorized');
        assert.ok(result.detail.includes('IT role required'));
    });

    test('should return 404 for non-existent user', async () => {
        const fakeUserId = randomUUID();

        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/users/${fakeUserId}/credentials/export`,
            headers: {
                cookie: itSessionCookie
            }
        });

        assert.strictEqual(response.statusCode, 404);
        const result = response.json();
        assert.strictEqual(result.title, 'User Not Found');
    });

    test('should return 403 for disabled user', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/users/${testDisabledUser.id}/credentials/export`,
            headers: {
                cookie: itSessionCookie
            }
        });

        assert.strictEqual(response.statusCode, 403);
        const result = response.json();
        assert.strictEqual(result.title, 'User Disabled');
    });

    test('should return 200 for user with no credentials', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/users/${testItUser.id}/credentials/export`,
            headers: {
                cookie: itSessionCookie
            }
        });

        assert.strictEqual(response.statusCode, 200);
        const contentType = response.headers['content-type'];
        assert.ok(contentType.includes('text/plain'));
        
        const body = response.payload;
        assert.ok(body.includes('IT-HUB CREDENTIAL EXPORT'));
        assert.ok(body.includes('Systems: 0'));
    });

    test('should set proper headers', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/users/${testItUser.id}/credentials/export`,
            headers: {
                cookie: itSessionCookie
            }
        });

        const contentType = response.headers['content-type'];
        const contentDisposition = response.headers['content-disposition'];
        const cacheControl = response.headers['cache-control'];
        const xContentTypeOptions = response.headers['x-content-type-options'];
        const xFrameOptions = response.headers['x-frame-options'];

        assert.ok(contentType.includes('text/plain'));
        assert.ok(contentDisposition.includes('attachment'));
        assert.ok(contentDisposition.includes('.txt'));
        assert.ok(cacheControl.includes('no-store'));
        assert.strictEqual(xContentTypeOptions, 'nosniff');
        assert.strictEqual(xFrameOptions, 'DENY');
    });

    test('should validate userId parameter format', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/users/invalid-uuid/credentials/export',
            headers: {
                cookie: itSessionCookie
            }
        });

        assert.strictEqual(response.statusCode, 400);
        const result = response.json();
        assert.strictEqual(result.title, 'Bad Request');
    });

    test('should return export in proper format', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/users/${testItUser.id}/credentials/export`,
            headers: {
                cookie: itSessionCookie
            }
        });

        const body = response.payload;

        assert.ok(body.includes('IT-HUB CREDENTIAL EXPORT'));
        assert.ok(body.includes('Generated:'));
        assert.ok(body.includes('User:'));
        assert.ok(body.includes('Systems: 0'));
        assert.ok(body.includes('End of export'));
    });

    test('should create audit log on export', async () => {
        const userId = testItUser.id;
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/users/${userId}/credentials/export`,
            headers: {
                cookie: itSessionCookie
            }
        });

        assert.strictEqual(response.statusCode, 200);

        const auditLogs = await prisma.auditLog.findMany({
            where: {
                action: 'credentials.export.single_user',
                entityId: userId,
                actorUserId: testItUser.id
            }
        });

        assert.ok(auditLogs.length > 0, 'Audit log should be created');
    });
});
