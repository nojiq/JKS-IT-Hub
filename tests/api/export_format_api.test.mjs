/**
 * Export Format API Tests
 * 
 * Tests for Story 3.3: Export Formatting Rules
 * - Format parameter validation (standard/compressed)
 * - Correct Content-Type and Content-Disposition headers
 * - Correct format output
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

test.describe('Export Format API', () => {
    let app;
    let testItUser;
    let itSessionCookie;
    let testUsers = [];

    test.before(async () => {
        testItUser = await prisma.user.create({
            data: {
                username: `test-it-fmt-${randomUUID()}`,
                role: 'it',
                status: 'active',
                ldapAttributes: { mail: 'test-it-fmt@example.com' }
            }
        });

        testUsers = [testItUser];

        const userRepo = {
            findUserByUsername: async (username) => testUsers.find(u => u.username === username),
            findUserById: async (id) => testUsers.find(u => u.id === id)
        };

        app = await createTestApp({ userRepoOverride: userRepo });
        itSessionCookie = await createSessionCookie(testItUser);
    });

    test('KV-1: should default to standard format when no param provided', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/users/${testItUser.id}/credentials/export`,
            headers: { cookie: itSessionCookie }
        });

        assert.strictEqual(response.statusCode, 200);
        assert.ok(response.headers['content-type'].includes('text/plain'));
        assert.ok(response.headers['content-disposition'].includes('.txt'));
        assert.ok(response.payload.includes('IT-HUB CREDENTIAL EXPORT'));
    });

    test('KV-2: should support compressed format via query param', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/users/${testItUser.id}/credentials/export?format=compressed`,
            headers: { cookie: itSessionCookie }
        });

        assert.strictEqual(response.statusCode, 200);
        assert.ok(response.headers['content-type'].includes('text/csv'));
        assert.ok(response.headers['content-disposition'].includes('.csv'));
        assert.ok(response.payload.includes('IT-HUB|EXPORT|SINGLE'));
    });

    test('KV-3: should reject invalid format parameter', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/users/${testItUser.id}/credentials/export?format=xml`,
            headers: { cookie: itSessionCookie }
        });

        assert.strictEqual(response.statusCode, 400);
        const result = response.json();
        assert.strictEqual(result.title, 'Bad Request');
        assert.match(result.detail, /Invalid format parameter/i);
    });

    test('KV-4: should support standard format via query param', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/users/${testItUser.id}/credentials/export?format=standard`,
            headers: { cookie: itSessionCookie }
        });

        assert.strictEqual(response.statusCode, 200);
        assert.ok(response.headers['content-type'].includes('text/plain'));
        assert.ok(response.payload.includes('IT-HUB CREDENTIAL EXPORT'));
    });

    test('KV-5: Batch Export - should default to standard', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/credentials/export/batch',
            headers: { cookie: itSessionCookie },
            payload: {
                userIds: [testItUser.id]
            }
        });

        assert.strictEqual(response.statusCode, 200);
        assert.ok(response.headers['content-type'].includes('text/plain'));
        assert.ok(response.headers['content-disposition'].includes('.txt'));
        assert.ok(response.payload.includes('IT-HUB BATCH CREDENTIAL EXPORT'));
    });

    test('KV-6: Batch Export - should support compressed', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/credentials/export/batch',
            headers: { cookie: itSessionCookie },
            payload: {
                userIds: [testItUser.id],
                format: 'compressed'
            }
        });

        assert.strictEqual(response.statusCode, 200);
        assert.ok(response.headers['content-type'].includes('text/csv'));
        assert.ok(response.headers['content-disposition'].includes('.csv'));
        assert.ok(response.payload.includes('IT-HUB|EXPORT|BATCH'));
    });

    test('KV-7: Batch Export - should reject invalid format', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/credentials/export/batch',
            headers: { cookie: itSessionCookie },
            payload: {
                userIds: [testItUser.id],
                format: 'json'
            }
        });

        assert.strictEqual(response.statusCode, 400);
    });

    test('KV-8: Single Export - should include format in audit metadata', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/users/${testItUser.id}/credentials/export?format=compressed`,
            headers: { cookie: itSessionCookie }
        });

        assert.strictEqual(response.statusCode, 200);

        const auditLog = await prisma.auditLog.findFirst({
            where: {
                action: 'credentials.export.single_user',
                actorUserId: testItUser.id,
                entityId: testItUser.id
            },
            orderBy: { createdAt: 'desc' }
        });

        assert.ok(auditLog, 'Expected single export audit log');
        assert.strictEqual(auditLog.metadata.format, 'compressed');
    });

    test('KV-9: Batch Export - should include format in audit metadata', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/credentials/export/batch',
            headers: { cookie: itSessionCookie },
            payload: {
                userIds: [testItUser.id],
                format: 'compressed'
            }
        });

        assert.strictEqual(response.statusCode, 200);

        const auditLog = await prisma.auditLog.findFirst({
            where: {
                action: 'credentials.export.batch',
                actorUserId: testItUser.id
            },
            orderBy: { createdAt: 'desc' }
        });

        assert.ok(auditLog, 'Expected batch export audit log');
        assert.strictEqual(auditLog.metadata.format, 'compressed');
    });
});
