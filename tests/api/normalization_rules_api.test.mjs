import test, { describe, it, after, afterEach, before } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");

import normalizationRuleRoutes from "../../apps/api/src/features/normalization-rules/routes.js";
import * as normalizationRuleService from "../../apps/api/src/features/normalization-rules/service.js";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";

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

const createTestApp = async (userRepo) => {
    const app = Fastify({ logger: false });
    await app.register(cookie);

    await app.register(normalizationRuleRoutes, {
        config: baseConfig,
        userRepo,
        normalizationRuleService
    });

    await app.ready();
    return app;
};

const createSessionCookie = async (userId, role = "it", username = "test-admin") => {
    const token = await signSessionToken({
        subject: userId,
        payload: {
            username: username,
            role: role
        }
    }, baseConfig.jwt);
    return `${baseConfig.cookie.name}=${token}`;
};

describe('NormalizationRule API', () => {
    let adminUser;
    let requesterUser;
    const createdUserIds = [];

    before(async () => {
        adminUser = await prisma.user.create({
            data: {
                username: `admin-${randomUUID()}`,
                role: 'admin',
                status: 'active'
            }
        });
        createdUserIds.push(adminUser.id);

        requesterUser = await prisma.user.create({
            data: {
                username: `requester-${randomUUID()}`,
                role: 'requester',
                status: 'active'
            }
        });
        createdUserIds.push(requesterUser.id);
    });

    afterEach(async () => {
        await prisma.normalizationRule.deleteMany({});
    });

    after(async () => {
        await prisma.normalizationRule.deleteMany({});
        if (createdUserIds.length > 0) {
            await prisma.user.deleteMany({
                where: { id: { in: createdUserIds } }
            });
        }
        await prisma.$disconnect();
    });

    it('POST / normalization-rules - should create a rule (Admin only)', async () => {
        const userRepo = {
            findUserByUsername: async (username) => username === adminUser.username ? adminUser : null,
            findUserById: async (id) => id === adminUser.id ? adminUser : null,
            isUserDisabled: () => false
        };
        const app = await createTestApp(userRepo);
        const cookie = await createSessionCookie(adminUser.id, 'admin', adminUser.username);

        const response = await app.inject({
            method: 'POST',
            url: '/',
            headers: { cookie },
            payload: {
                ruleType: 'lowercase',
                priority: 10
            }
        });

        assert.equal(response.statusCode, 201);
        const body = response.json();
        assert.equal(body.data.ruleType, 'lowercase');
        assert.equal(body.data.priority, 10);

        await app.close();
    });

    it('POST / normalization-rules - should reject non-IT users', async () => {
        const userRepo = {
            findUserByUsername: async (username) => username === requesterUser.username ? requesterUser : null,
            findUserById: async (id) => id === requesterUser.id ? requesterUser : null,
            isUserDisabled: () => false
        };
        const app = await createTestApp(userRepo);
        const cookie = await createSessionCookie(requesterUser.id, 'requester', requesterUser.username);

        const response = await app.inject({
            method: 'POST',
            url: '/',
            headers: { cookie },
            payload: {
                ruleType: 'lowercase',
                priority: 10
            }
        });

        assert.equal(response.statusCode, 403);
        await app.close();
    });

    it('GET / normalization-rules - should list rules', async () => {
        const userRepo = {
            findUserByUsername: async (username) => username === adminUser.username ? adminUser : null,
            findUserById: async (id) => id === adminUser.id ? adminUser : null,
            isUserDisabled: () => false
        };
        const app = await createTestApp(userRepo);
        const cookie = await createSessionCookie(adminUser.id, 'admin', adminUser.username);

        const response = await app.inject({
            method: 'GET',
            url: '/',
            headers: { cookie }
        });

        assert.equal(response.statusCode, 200);
        const body = response.json();
        assert.ok(Array.isArray(body.data.global));
        await app.close();
    });

    it('POST /preview - should preview normalization', async () => {
        const userRepo = {
            findUserByUsername: async (username) => username === adminUser.username ? adminUser : null,
            findUserById: async (id) => id === adminUser.id ? adminUser : null,
            isUserDisabled: () => false
        };
        const app = await createTestApp(userRepo);
        const cookie = await createSessionCookie(adminUser.id, 'admin', adminUser.username);

        // Create a rule for the preview test
        await normalizationRuleService.createNormalizationRule({
            ruleType: 'lowercase',
            priority: 0
        }, adminUser.id);

        const response = await app.inject({
            method: 'POST',
            url: '/preview',
            headers: { cookie },
            payload: {
                value: 'MIXED.Case'
            }
        });

        assert.equal(response.statusCode, 200);
        const body = response.json();
        assert.equal(body.data.normalized, 'mixed.case');
        await app.close();
    });
});
