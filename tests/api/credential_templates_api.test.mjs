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
        prefix: "/api/v1/credential-templates",
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

test("POST /api/v1/credential-templates creates a new template", async () => {
    const actor = await createUser({ username: `cred-test-${randomUUID()}`, role: "it" });

    const userRepoMock = {
        findUserByUsername: async (username) => {
            if (username === actor.username) return actor;
            return null;
        }
    };

    const credentialServiceMock = {
        createTemplate: async (userId, data) => {
            return {
                id: "template-123",
                ...data,
                version: 1,
                isActive: true,
                createdBy: userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credential-templates",
        headers: {
            cookie: await createSessionCookie(actor)
        },
        payload: {
            name: "Test Template",
            structure: { field: "value" }
        }
    });

    assert.equal(response.statusCode, 201);
    const body = response.json();
    assert.equal(body.data.name, "Test Template");
});

test("GET /api/v1/credential-templates list templates", async () => {
    const actor = await createUser({ username: `cred-list-${randomUUID()}`, role: "it" });

    const userRepoMock = {
        findUserByUsername: async (u) => u === actor.username ? actor : null
    };

    const credentialServiceMock = {
        listTemplates: async () => ([
            { id: "1", name: "T1", version: 1 }
        ])
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock });

    const response = await app.inject({
        method: "GET",
        url: "/api/v1/credential-templates",
        headers: { cookie: await createSessionCookie(actor) }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].name, "T1");
});

test("GET /api/v1/credential-templates/:id returns template", async () => {
    const actor = await createUser({ username: `cred-get-${randomUUID()}`, role: "it" });

    const userRepoMock = {
        findUserByUsername: async (u) => u === actor.username ? actor : null
    };

    const credentialServiceMock = {
        getTemplate: async (id) => {
            if (id === "123") return { id: "123", name: "Found" };
            return null;
        }
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock });

    const response = await app.inject({
        method: "GET",
        url: "/api/v1/credential-templates/123",
        headers: { cookie: await createSessionCookie(actor) }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.name, "Found");

    const notFound = await app.inject({
        method: "GET",
        url: "/api/v1/credential-templates/999",
        headers: { cookie: await createSessionCookie(actor) }
    });
    assert.equal(notFound.statusCode, 404);
});

test("PUT /api/v1/credential-templates/:id updates template", async () => {
    const actor = await createUser({ username: `cred-upd-${randomUUID()}`, role: "it" });

    const userRepoMock = {
        findUserByUsername: async (u) => u === actor.username ? actor : null
    };

    const credentialServiceMock = {
        updateTemplate: async (userId, id, data) => {
            if (id === "123") return { id, ...data, version: 2 };
            return null;
        }
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock });

    const response = await app.inject({
        method: "PUT",
        url: "/api/v1/credential-templates/123",
        headers: { cookie: await createSessionCookie(actor) },
        payload: { name: "Updated", structure: {} }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.version, 2);
});

test("POST /api/v1/credential-templates creates audit log", async () => {
    const actor = await createUser({ username: `cred-audit-${randomUUID()}`, role: "it" });
    const userRepoMock = { findUserByUsername: async (u) => u === actor.username ? actor : null };
    const credentialServiceMock = {
        createTemplate: async (uid, data) => ({ id: "123", ...data, version: 1 })
    };

    let logCreated = null;
    const auditRepoMock = {
        createAuditLog: async (log) => { logCreated = log; }
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock, auditRepo: auditRepoMock });

    await app.inject({
        method: "POST",
        url: "/api/v1/credential-templates",
        headers: { cookie: await createSessionCookie(actor) },
        payload: { name: "Audit Test", structure: {} }
    });

    assert.ok(logCreated);
    assert.equal(logCreated.action, "credential_template.create");
});


