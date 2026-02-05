
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";
import { createUser } from "../../apps/api/src/features/users/repo.js";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";
import credentialRoutes from "../../apps/api/src/features/credentials/routes.js";

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

const createTestApp = async ({ userRepo, credentialService, auditRepo } = {}) => {
    const app = Fastify({ logger: false });
    await app.register(cookie);

    await app.register(credentialRoutes, {
        prefix: "/api/v1/credentials",
        config: baseConfig,
        userRepo,
        credentialService,
        auditRepo
    });

    await app.ready();
    return app;
};

after(async () => {
    await prisma.$disconnect();
});

test("POST /lock requires IT role", async () => {
    const actor = await createUser({ username: `lock-fail-${randomUUID()}`, role: "requester" });
    const userRepoMock = { findUserByUsername: async (u) => u === actor.username ? actor : null };
    const app = await createTestApp({ userRepo: userRepoMock, credentialService: {} });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credentials/u1/s1/lock",
        headers: { cookie: await createSessionCookie(actor) }
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().type, "/problems/insufficient-permissions");
});

test("POST /lock calls service and returns result", async () => {
    const actor = await createUser({ username: `lock-ok-${randomUUID()}`, role: "it" });
    const userRepoMock = { findUserByUsername: async (u) => u === actor.username ? actor : null };

    let lockCalled = false;
    const credentialServiceMock = {
        lockCredential: async (uid, sid, reason, actorId) => {
            lockCalled = true;
            return { id: "lock1", userId: uid, systemId: sid, isLocked: true };
        }
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credentials/user1/sys1/lock",
        headers: { cookie: await createSessionCookie(actor) },
        payload: { reason: "Security violation" }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data, { id: "lock1", userId: "user1", systemId: "sys1", isLocked: true });
    assert.ok(lockCalled);
});

test("POST /lock returns problem details when credential not found", async () => {
    const actor = await createUser({ username: `lock-missing-${randomUUID()}`, role: "it" });
    const userRepoMock = { findUserByUsername: async (u) => u === actor.username ? actor : null };

    const credentialServiceMock = {
        lockCredential: async () => {
            const error = new Error("Credential not found");
            error.code = "CREDENTIAL_NOT_FOUND";
            error.userId = "user1";
            error.systemId = "sys1";
            throw error;
        }
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credentials/user1/sys1/lock",
        headers: { cookie: await createSessionCookie(actor) }
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json().type, "/problems/credential-not-found");
});

test("POST /lock returns problem details when already locked", async () => {
    const actor = await createUser({ username: `lock-already-${randomUUID()}`, role: "it" });
    const userRepoMock = { findUserByUsername: async (u) => u === actor.username ? actor : null };

    const credentialServiceMock = {
        lockCredential: async () => {
            const error = new Error("Credential already locked");
            error.code = "CREDENTIAL_ALREADY_LOCKED";
            error.userId = "user1";
            error.systemId = "sys1";
            throw error;
        }
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credentials/user1/sys1/lock",
        headers: { cookie: await createSessionCookie(actor) }
    });

    assert.equal(response.statusCode, 409);
    assert.equal(response.json().type, "/problems/credential-already-locked");
});

test("GET /lock-status returns status and lock details", async () => {
    const actor = await createUser({ username: `lock-stat-${randomUUID()}`, role: "it" });
    const lockedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const userRepoMock = { findUserByUsername: async (u) => u === actor.username ? actor : null };

    const credentialServiceMock = {
        getLockStatus: async () => {
            return {
                isLocked: true,
                lockDetails: {
                    lockedBy: "locker",
                    lockedByName: "Locker",
                    lockedAt,
                    lockReason: "Policy",
                    daysLocked: 2
                }
            };
        }
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock });

    const response = await app.inject({
        method: "GET",
        url: "/api/v1/credentials/user1/sys1/lock-status",
        headers: { cookie: await createSessionCookie(actor) }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.isLocked, true);
    assert.equal(body.data.lockDetails.lockedByName, "Locker");
    assert.equal(body.data.lockDetails.lockReason, "Policy");
    assert.equal(typeof body.data.lockDetails.daysLocked, "number");
});

test("POST /unlock calls service", async () => {
    const actor = await createUser({ username: `unlock-${randomUUID()}`, role: "it" });
    const userRepoMock = { findUserByUsername: async (u) => u === actor.username ? actor : null };

    let unlockCalled = false;
    const credentialServiceMock = {
        unlockCredential: async (uid, sid, actorId) => {
            unlockCalled = true;
            return { isLocked: false };
        }
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credentials/user1/sys1/unlock",
        headers: { cookie: await createSessionCookie(actor) }
    });

    assert.equal(response.statusCode, 200);
    assert.ok(unlockCalled);
});

test("POST /unlock returns problem details when not locked", async () => {
    const actor = await createUser({ username: `unlock-missing-${randomUUID()}`, role: "it" });
    const userRepoMock = { findUserByUsername: async (u) => u === actor.username ? actor : null };

    const credentialServiceMock = {
        unlockCredential: async () => {
            const error = new Error("Credential not locked");
            error.code = "CREDENTIAL_NOT_LOCKED";
            error.userId = "user1";
            error.systemId = "sys1";
            throw error;
        }
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credentials/user1/sys1/unlock",
        headers: { cookie: await createSessionCookie(actor) }
    });

    assert.equal(response.statusCode, 409);
    assert.equal(response.json().type, "/problems/credential-not-locked");
});

test("GET /locked lists credentials", async () => {
    const actor = await createUser({ username: `list-lock-${randomUUID()}`, role: "it" });
    const userRepoMock = {
        findUserByUsername: async (u) => u === actor.username ? actor : null
    };

    const credentialServiceMock = {
        getLockedCredentials: async () => ({
            data: [{
                id: "l1",
                userId: "u1",
                userName: "Jane",
                userEmail: "jane@example.com",
                systemId: "sys1",
                systemName: "System One",
                lockedBy: "locker1",
                lockedByName: "Locker",
                lockedAt: "2026-02-01T00:00:00Z",
                lockReason: "Policy"
            }],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
        })
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock });

    const response = await app.inject({
        method: "GET",
        url: "/api/v1/credentials/locked",
        headers: { cookie: await createSessionCookie(actor) }
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.data.length, 1);
    assert.equal(payload.data[0].userName, "Jane");
    assert.equal(payload.data[0].lockedByName, "Locker");
    assert.equal(payload.data[0].systemName, "System One");
});
