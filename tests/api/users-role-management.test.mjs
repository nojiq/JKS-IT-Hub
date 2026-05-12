
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

test("PATCH /users/:id/role updates role for legitimate admin", async () => {
    const adminUser = { id: "admin-1", username: "admin", role: "admin", status: "active" };
    const targetUser = { id: "user-1", username: "john", role: "requester", status: "active" };

    const userRepo = createMockUserRepo([adminUser, targetUser]);
    const auditRepo = createMockAuditRepo();
    const app = await createTestApp({ userRepo, auditRepo });

    const headers = await generateAuthHeader(adminUser);

    const response = await app.inject({
        method: "PATCH",
        url: `/users/${targetUser.id}/role`,
        headers,
        payload: { role: "it" }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.user.role, "it");
    assert.equal(body.data.user.id, targetUser.id);

    const logs = auditRepo.getLogs();
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, "user.role_update");
    assert.equal(logs[0].metadata.changes[0].field, "role");
    assert.equal(logs[0].metadata.changes[0].old, "requester");
    assert.equal(logs[0].metadata.changes[0].new, "it");
    assert.equal(logs[0].actorUserId, adminUser.id);
});

test("PATCH /users/:id/role forbids IT from assigning disallowed roles (e.g. admin)", async () => {
    const itUser = { id: "it-1", username: "it", role: "it", status: "active" };
    const targetUser = { id: "user-1", username: "john", role: "requester", status: "active" };

    const userRepo = createMockUserRepo([itUser, targetUser]);
    const auditRepo = createMockAuditRepo();
    const app = await createTestApp({ userRepo, auditRepo });

    const headers = await generateAuthHeader(itUser);

    const response = await app.inject({
        method: "PATCH",
        url: `/users/${targetUser.id}/role`,
        headers,
        payload: { role: "admin" }
    });

    assert.equal(response.statusCode, 403);
});

test("PATCH /users/:id/role allows IT to assign requester to peer IT", async () => {
    const itUser = { id: "it-1", username: "it", role: "it", status: "active" };
    const targetUser = { id: "user-2", username: "jane", role: "it", status: "active" };

    const userRepo = createMockUserRepo([itUser, targetUser]);
    const auditRepo = createMockAuditRepo();
    const app = await createTestApp({ userRepo, auditRepo });
    const headers = await generateAuthHeader(itUser);

    const response = await app.inject({
        method: "PATCH",
        url: `/users/${targetUser.id}/role`,
        headers,
        payload: { role: "requester" }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.user.role, "requester");
});

test("PATCH /users/:id/role forbids IT from changing users above IT rank", async () => {
    const itUser = { id: "it-1", username: "it", role: "it", status: "active" };
    const adminUser = { id: "admin-1", username: "boss", role: "admin", status: "active" };

    const userRepo = createMockUserRepo([itUser, adminUser]);
    const auditRepo = createMockAuditRepo();
    const app = await createTestApp({ userRepo, auditRepo });
    const headers = await generateAuthHeader(itUser);

    const response = await app.inject({
        method: "PATCH",
        url: `/users/${adminUser.id}/role`,
        headers,
        payload: { role: "requester" }
    });

    assert.equal(response.statusCode, 403);
});

test("PATCH /users/:id/role allows dev to grant admin", async () => {
    const devUser = { id: "dev-1", username: "dev", role: "dev", status: "active" };
    const targetUser = { id: "user-1", username: "john", role: "requester", status: "active" };

    const userRepo = createMockUserRepo([devUser, targetUser]);
    const auditRepo = createMockAuditRepo();
    const app = await createTestApp({ userRepo, auditRepo });
    const headers = await generateAuthHeader(devUser);

    const response = await app.inject({
        method: "PATCH",
        url: `/users/${targetUser.id}/role`,
        headers,
        payload: { role: "admin" }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.user.role, "admin");
});

test("PATCH /users/:id/role rejects dev role in body", async () => {
    const devUser = { id: "dev-1", username: "dev", role: "dev", status: "active" };
    const targetUser = { id: "user-1", username: "john", role: "requester", status: "active" };

    const userRepo = createMockUserRepo([devUser, targetUser]);
    const auditRepo = createMockAuditRepo();
    const app = await createTestApp({ userRepo, auditRepo });
    const headers = await generateAuthHeader(devUser);

    const response = await app.inject({
        method: "PATCH",
        url: `/users/${targetUser.id}/role`,
        headers,
        payload: { role: "dev" }
    });

    assert.equal(response.statusCode, 400);
});

test("PATCH /users/:id/role forbids changing your own role", async () => {
    const adminUser = { id: "admin-1", username: "admin", role: "admin", status: "active" };

    const userRepo = createMockUserRepo([adminUser]);
    const auditRepo = createMockAuditRepo();
    const app = await createTestApp({ userRepo, auditRepo });
    const headers = await generateAuthHeader(adminUser);

    const response = await app.inject({
        method: "PATCH",
        url: `/users/${adminUser.id}/role`,
        headers,
        payload: { role: "it" }
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().detail, "You cannot change your own role.");
});

test("PATCH /users/:id/role forbids invalid role", async () => {
    const adminUser = { id: "admin-1", username: "admin", role: "admin", status: "active" };
    const targetUser = { id: "user-1", username: "john", role: "requester", status: "active" };

    const userRepo = createMockUserRepo([adminUser, targetUser]);
    const auditRepo = createMockAuditRepo();
    const app = await createTestApp({ userRepo, auditRepo });

    const headers = await generateAuthHeader(adminUser);

    const response = await app.inject({
        method: "PATCH",
        url: `/users/${targetUser.id}/role`,
        headers,
        payload: { role: "super_admin" } // Invalid role
    });

    assert.equal(response.statusCode, 400);
});

test("GET /users/:id/audit-logs returns history", async () => {
    const user = { id: "user-1", username: "john", role: "requester", status: "active" };
    const itUser = { id: "it-1", username: "it", role: "it", status: "active" };

    // Mock audit logs
    const logs = [
        {
            createdAt: new Date(),
            entityId: "user-1",
            entityType: "user",
            actorUser: { username: "admin" },
            metadata: {
                changes: [
                    { field: "status", old: "active", new: "disabled" }
                ]
            }
        }
    ];

    const userRepo = createMockUserRepo([user, itUser]);
    const auditRepo = {
        findAuditLogsByEntity: async (id, type) => logs,
        createAuditLog: async () => { }
    };

    const app = await createTestApp({ userRepo, auditRepo });
    const headers = await generateAuthHeader(itUser);

    const response = await app.inject({
        method: "GET",
        url: `/users/${user.id}/audit-logs`,
        headers
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].field, "status");
});
