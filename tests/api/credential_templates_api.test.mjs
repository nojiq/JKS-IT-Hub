import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/it_hub_test";

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
    const { default: credentialRoutes } = await import("../../apps/api/src/features/credentials/routes.js");
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

test("POST /api/v1/credential-templates creates a new template for IT role", async () => {
    const actor = { id: randomUUID(), username: "it_user", role: "it", status: "active" };

    const userRepoMock = {
        findUserByUsername: async (username) => (username === actor.username ? actor : null)
    };

    const credentialServiceMock = {
        createTemplate: async (userId, data) => ({
            id: "template-123",
            ...data,
            version: 1,
            isActive: true,
            createdBy: userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credential-templates",
        headers: { cookie: await createSessionCookie(actor) },
        payload: {
            name: "Test Template",
            structure: {
                systems: ["email"],
                fields: [{ name: "username", ldapSource: "mail", required: true }]
            }
        }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().data.name, "Test Template");
});

test("GET /api/v1/credential-templates allows admin role to view templates", async () => {
    const actor = { id: randomUUID(), username: "admin_user", role: "admin", status: "active" };

    const userRepoMock = {
        findUserByUsername: async (username) => (username === actor.username ? actor : null)
    };

    const credentialServiceMock = {
        listTemplates: async () => [{ id: "template-1", name: "Default onboarding", version: 1 }]
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock });

    const response = await app.inject({
        method: "GET",
        url: "/api/v1/credential-templates",
        headers: { cookie: await createSessionCookie(actor) }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data[0].id, "template-1");
});

test("template endpoints reject requester role", async () => {
    const actor = { id: randomUUID(), username: "requester_user", role: "requester", status: "active" };

    const userRepoMock = {
        findUserByUsername: async (username) => (username === actor.username ? actor : null)
    };

    const credentialServiceMock = {
        listTemplates: async () => []
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock });

    const response = await app.inject({
        method: "GET",
        url: "/api/v1/credential-templates",
        headers: { cookie: await createSessionCookie(actor) }
    });

    assert.equal(response.statusCode, 403);
    assert.match(response.json().detail, /Only IT roles can view credential templates/);
});

test("POST /api/v1/credential-templates rejects invalid structure payload", async () => {
    const actor = { id: randomUUID(), username: "it_user_2", role: "it", status: "active" };

    const userRepoMock = {
        findUserByUsername: async (username) => (username === actor.username ? actor : null)
    };

    const credentialServiceMock = {
        createTemplate: async () => {
            throw new Error("should not be called for invalid payload");
        }
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credential-templates",
        headers: { cookie: await createSessionCookie(actor) },
        payload: {
            name: "Broken Template",
            structure: {
                systems: [],
                fields: []
            }
        }
    });

    assert.equal(response.statusCode, 400);
});

test("PUT /api/v1/credential-templates/:id accepts partial update (isActive)", async () => {
    const actor = { id: randomUUID(), username: "it_user_3", role: "it", status: "active" };

    const userRepoMock = {
        findUserByUsername: async (username) => (username === actor.username ? actor : null)
    };

    const credentialServiceMock = {
        updateTemplate: async (_userId, id, data) => ({
            id,
            name: "Template",
            description: "desc",
            structure: {
                systems: ["email"],
                fields: [{ name: "username", ldapSource: "mail", required: true }]
            },
            version: 2,
            isActive: data.isActive
        })
    };

    const app = await createTestApp({ userRepo: userRepoMock, credentialService: credentialServiceMock });

    const response = await app.inject({
        method: "PUT",
        url: "/api/v1/credential-templates/template-123",
        headers: { cookie: await createSessionCookie(actor) },
        payload: { isActive: false }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.isActive, false);
});
