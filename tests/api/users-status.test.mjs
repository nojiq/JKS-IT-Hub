
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");
import userRoutes from "../../apps/api/src/features/users/routes.js";
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
    ldapSync: {
        usernameAttribute: "uid",
        attributes: ["cn", "mail"]
    }
};

const createMockUserRepo = (initialUsers = []) => {
    const users = [...initialUsers];

    return {
        findUserByUsername: async (username) => users.find(u => u.username === username),
        findUserById: async (id) => users.find(u => u.id === id),
        updateUserRole: async (id, role) => {
            const idx = users.findIndex(u => u.id === id);
            if (idx === -1) throw new Error("User not found");
            users[idx] = { ...users[idx], role };
            return users[idx];
        },
        updateUserStatus: async (id, status) => {
            const idx = users.findIndex(u => u.id === id);
            if (idx === -1) throw new Error("User not found");
            users[idx] = { ...users[idx], status };
            return users[idx];
        },
        listUsers: async () => users,
        isUserDisabled: (user) => user?.status === "disabled"
    };
};

const createMockAuditRepo = () => {
    const logs = [];
    return {
        createAuditLog: async (log) => {
            logs.push({ ...log, createdAt: new Date() });
            return log;
        },
        findAuditLogsByEntity: async (id, type) => logs.filter(l => l.entityId === id && l.entityType === type),
        getLogs: () => logs
    };
};

const createTestApp = async ({ userRepo, auditRepo }) => {
    const app = Fastify({ logger: false });
    await app.register(cookie);
    await app.register(userRoutes, {
        config: baseConfig,
        userRepo,
        auditRepo
    });
    await app.ready();
    return app;
};

const generateAuthHeader = async (user) => {
    const token = await signSessionToken({
        subject: user.id,
        payload: {
            username: user.username,
            role: user.role,
            status: user.status
        }
    }, baseConfig.jwt);
    return {
        cookie: `${baseConfig.cookie.name}=${token}`
    };
};

test("PATCH /users/:id/status updates status for legitimate admin", async () => {
    const adminUser = { id: "admin-1", username: "admin", role: "admin", status: "active" };
    const targetUser = { id: "user-1", username: "john", role: "requester", status: "active" };

    const userRepo = createMockUserRepo([adminUser, targetUser]);
    const auditRepo = createMockAuditRepo();
    const app = await createTestApp({ userRepo, auditRepo });

    const headers = await generateAuthHeader(adminUser);

    const response = await app.inject({
        method: "PATCH",
        url: `/users/${targetUser.id}/status`,
        headers,
        payload: { status: "disabled" }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.user.status, "disabled");
    assert.equal(body.data.user.id, targetUser.id);

    const logs = auditRepo.getLogs();
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, "user.status_change");
    assert.equal(logs[0].metadata.changes[0].field, "status");
    assert.equal(logs[0].metadata.changes[0].old, "active");
    assert.equal(logs[0].metadata.changes[0].new, "disabled");
    assert.equal(logs[0].actorUserId, adminUser.id);
});

test("PATCH /users/:id/status forbids non-admin users", async () => {
    const itUser = { id: "it-1", username: "it", role: "it", status: "active" };
    const targetUser = { id: "user-1", username: "john", role: "requester", status: "active" };

    const userRepo = createMockUserRepo([itUser, targetUser]);
    const auditRepo = createMockAuditRepo();
    const app = await createTestApp({ userRepo, auditRepo });

    const headers = await generateAuthHeader(itUser);

    // IT users cannot change status (only Admin/Head) per story?
    // Story says: "As Admin/Head of IT, I want to disable or enable users"
    // Does it explicitly forbid IT?
    // AC 1: "When Admin/Head disables the user"
    // Implementation uses requireAdminOrHead, which excludes IT role.
    // So expected 403 for IT.

    const response = await app.inject({
        method: "PATCH",
        url: `/users/${targetUser.id}/status`,
        headers,
        payload: { status: "disabled" }
    });

    assert.equal(response.statusCode, 403);
});

test("PATCH /users/:id/status forbids invalid status", async () => {
    const adminUser = { id: "admin-1", username: "admin", role: "admin", status: "active" };
    const targetUser = { id: "user-1", username: "john", role: "requester", status: "active" };

    const userRepo = createMockUserRepo([adminUser, targetUser]);
    const auditRepo = createMockAuditRepo();
    const app = await createTestApp({ userRepo, auditRepo });

    const headers = await generateAuthHeader(adminUser);

    const response = await app.inject({
        method: "PATCH",
        url: `/users/${targetUser.id}/status`,
        headers,
        payload: { status: "suspended" } // Invalid status
    });

    assert.equal(response.statusCode, 400);
});
