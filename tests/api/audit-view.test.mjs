
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { createAuditLog, prisma } from "../../apps/api/src/features/audit/repo.js";
import { createUser } from "../../apps/api/src/features/users/repo.js";

// Track created users for cleanup
const createdUserIds = [];

after(async () => {
    // Clean up test users
    if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({
            where: { id: { in: createdUserIds } }
        });
    }
    await prisma.$disconnect();
});

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");

import authRoutes from "../../apps/api/src/features/auth/routes.js";
import auditRoutes from "../../apps/api/src/features/audit/routes.js";
import usersRoutes from "../../apps/api/src/features/users/routes.js";
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
    },
    cors: {
        origin: "http://localhost:5176"
    },
    ldapSync: {
        // Mock config for users route
        usernameAttribute: "uid",
        attributes: ["cn", "mail"]
    }
};

const createTestApp = async ({ userRepo }) => {
    const app = Fastify({ logger: false });
    await app.register(cookie);

    // Register routes
    await app.register(auditRoutes, {
        config: baseConfig,
        userRepo,
        auditRepo: await import("../../apps/api/src/features/audit/repo.js")
    });

    await app.register(usersRoutes, {
        config: baseConfig,
        userRepo,
        auditRepo: await import("../../apps/api/src/features/audit/repo.js")
    });

    await app.ready();
    return app;
};

// Helper: Create a session cookie for a user
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

test("GET /audit-logs returns paged logs for authenticated IT user", async () => {
    const testId = randomUUID();

    // Create a real user in the DB for the actor
    const actor = await createUser({
        username: `audit-viewer-${randomUUID()}`,
        role: "it",
        status: "active"
    });
    createdUserIds.push(actor.id);
    const actorId = actor.id;

    // Seed some logs
    await createAuditLog({
        action: "test.action.1",
        actorUserId: actorId,
        entityType: "test",
        entityId: testId,
        metadata: { key: "value1" }
    });
    await createAuditLog({
        action: "test.action.2",
        actorUserId: actorId,
        entityType: "test",
        entityId: testId,
        metadata: { key: "value2" }
    });

    // Mock User Repo that uses the real actor for auth lookups
    const userRepo = {
        findUserByUsername: async (username) => {
            if (username === actor.username) return actor;
            return null;
        },
        findUserById: async (id) => {
            if (id === actorId) return actor;
            return null;
        },
        isUserDisabled: () => false,
        listUsers: async () => []
    };

    const app = await createTestApp({ userRepo });
    // Use the actual username so that if requireItUser looks up by ID or username from session, it matches
    const cookie = await createSessionCookie(actorId, "it", actor.username);

    const response = await app.inject({
        method: "GET",
        url: "/audit-logs?limit=10",
        headers: { cookie }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();

    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.some(log => log.entityId === testId));
    assert.ok(body.meta, "Should have meta pagination info");
    assert.equal(body.meta.limit, 10);

    await app.close();
});

test("GET /users/:id/audit-logs returns history for specific user", async () => {
    const targetUser = await createUser({
        username: `target-user-${randomUUID()}`,
        role: "requester",
        status: "active"
    });
    createdUserIds.push(targetUser.id);
    const userId = targetUser.id;

    // Create admin user in DB
    const adminUser = await createUser({
        username: `admin-user-${randomUUID()}`,
        role: "it",
        status: "active"
    });
    createdUserIds.push(adminUser.id);

    // Seed logs for this user with 'changes' metadata
    await createAuditLog({
        action: "user.update",
        actorUserId: null, // System
        entityType: "user",
        entityId: userId,
        metadata: {
            changes: [
                { field: "email", old: "a@b.com", new: "b@b.com" }
            ]
        }
    });

    // Seed log without changes
    await createAuditLog({
        action: "user.view",
        actorUserId: adminUser.id,
        entityType: "user",
        entityId: userId,
        metadata: { ip: "127.0.0.1" }
    });

    const userRepo = {
        findUserByUsername: async (username) => {
            if (username === "test-admin") return adminUser;
            return null;
        },
        findUserById: async (id) => {
            if (id === userId) return targetUser;
            if (id === adminUser.id) return adminUser;
            return null;
        },
        isUserDisabled: () => false
    };

    const app = await createTestApp({ userRepo });
    const cookie = await createSessionCookie(adminUser.id, "it");

    const response = await app.inject({
        method: "GET",
        url: `/users/${userId}/audit-logs`,
        headers: { cookie }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();

    // The specific endpoint flatmaps the changes
    assert.ok(Array.isArray(body.data));
    const changeLog = body.data.find(item => item.field === "email");
    assert.ok(changeLog, "Should find the email change log");
    assert.equal(changeLog.oldValue, "a@b.com");
    assert.equal(changeLog.newValue, "b@b.com");

    await app.close();
});

test("Security: Unauthenticated access forbidden", async () => {
    const userRepo = {};
    const app = await createTestApp({ userRepo });

    const response = await app.inject({
        method: "GET",
        url: "/audit-logs"
    });

    assert.equal(response.statusCode, 401);
    await app.close();
});

test("Security: Non-IT user access forbidden", async () => {
    const testId = randomUUID();
    // Create a requester user
    const actor = await createUser({
        username: `requester-${randomUUID()}`,
        role: "requester",
        status: "active"
    });
    createdUserIds.push(actor.id);

    // Mock user repo
    const userRepo = {
        findUserByUsername: async (username) => actor,
        findUserById: async (id) => actor,
        isUserDisabled: () => false
    };

    const app = await createTestApp({ userRepo });
    const cookie = await createSessionCookie(actor.id, "requester");

    const response = await app.inject({
        method: "GET",
        url: "/audit-logs",
        headers: { cookie }
    });

    assert.equal(response.statusCode, 403, "Should be forbidden for non-IT users");

    await app.close();
});
