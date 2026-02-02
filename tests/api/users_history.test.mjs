import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { createAuditLog, prisma } from "../../apps/api/src/features/audit/repo.js";

after(async () => {
    await prisma.$disconnect();
});

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");

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
    await app.register(usersRoutes, {
        config: config ?? baseConfig,
        userRepo: userRepo,
        auditRepo: auditRepo
    });
    await app.ready();
    return app;
};

test("GET /users/:id/audit-logs returns history", async () => {
    const targetUser = {
        id: randomUUID(),
        username: "target",
        role: "requester",
        status: "active"
    };

    const itUser = {
        id: "it-user-1",
        username: "admin",
        role: "it",
        status: "active"
    };

    const userRepoMock = {
        findUserById: async (id) => {
            if (id === targetUser.id) return targetUser;
            if (id === itUser.id) return itUser;
            return null;
        },
        findUserByUsername: async (username) => {
            if (username === itUser.username) return itUser;
            return null;
        },
        // Mocks for listUsers if needed, but not for this test
        listUsers: async () => []
    };

    // Insert Audit Log into REAL DB with targetUser.id
    await createAuditLog({
        action: "user.ldap_update",
        actorUserId: null,
        entityType: "user",
        entityId: targetUser.id,
        metadata: {
            changes: [
                { field: "department", old: "Sales", new: "Engineering" }
            ]
        }
    });

    const auditRepo = await import("../../apps/api/src/features/audit/repo.js");
    const app = await createTestApp({ userRepo: userRepoMock, auditRepo });

    // Test as IT user
    const response = await app.inject({
        method: "GET",
        url: `/users/${targetUser.id}/audit-logs`,
        headers: {
            cookie: await createSessionCookie(itUser)
        }
    });

    assert.equal(response.statusCode, 200, "Should return 200 OK");
    const body = response.json();
    const history = body.data;

    assert.ok(Array.isArray(history), "Data should be an array");
    const entry = history.find(h => h.field === "department" && h.newValue === "Engineering");
    assert.ok(entry, "Should find the specific change entry");
    assert.equal(entry.oldValue, "Sales");
    assert.equal(entry.actor, "System");

    await app.close();
});
