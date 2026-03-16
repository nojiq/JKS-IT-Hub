import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";

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

const createTestApp = async ({ userRepo, onboardingService } = {}) => {
    const { default: onboardingRoutes } = await import("../../apps/api/src/features/onboarding/routes.js");
    const app = Fastify({ logger: false });
    await app.register(cookie);
    await app.register(onboardingRoutes, {
        prefix: "/api/v1/onboarding",
        config: baseConfig,
        userRepo,
        onboardingService
    });
    await app.ready();
    return app;
};

test("GET /api/v1/onboarding/catalog-items lists catalog items for IT", async () => {
    const actor = { id: randomUUID(), username: "it_user", role: "it", status: "active" };
    const app = await createTestApp({
        userRepo: {
            findUserByUsername: async (username) => (username === actor.username ? actor : null)
        },
        onboardingService: {
            listCatalogItems: async () => [{ id: "sigma", itemKey: "sigma", label: "Sigma" }]
        }
    });

    const response = await app.inject({
        method: "GET",
        url: "/api/v1/onboarding/catalog-items",
        headers: { cookie: await createSessionCookie(actor) }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data[0].itemKey, "sigma");
});

test("POST /api/v1/onboarding/department-bundles creates a department bundle", async () => {
    const actor = { id: randomUUID(), username: "it_user", role: "it", status: "active" };
    const app = await createTestApp({
        userRepo: {
            findUserByUsername: async (username) => (username === actor.username ? actor : null)
        },
        onboardingService: {
            createDepartmentBundle: async (data) => ({ id: "bundle-1", ...data })
        }
    });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/onboarding/department-bundles",
        headers: { cookie: await createSessionCookie(actor) },
        payload: {
            department: "Marketing",
            catalogItemKeys: ["canva", "basecamp"],
            isActive: true
        }
    });

    assert.equal(response.statusCode, 201);
    assert.deepEqual(response.json().data.catalogItemKeys, ["canva", "basecamp"]);
});

test("POST /api/v1/onboarding/preview returns setup sheet preview", async () => {
    const actor = { id: randomUUID(), username: "it_user", role: "it", status: "active" };
    const app = await createTestApp({
        userRepo: {
            findUserByUsername: async (username) => (username === actor.username ? actor : null)
        },
        onboardingService: {
            previewOnboardingSetup: async () => ({
                previewToken: "preview-1",
                source: { mode: "manual", department: "Marketing" },
                recommendedItemKeys: ["canva"],
                setupSheet: {
                    entries: [
                        {
                            systemId: "canva",
                            label: "Canva",
                            loginUrl: "https://canva.example",
                            username: "haziq.afendi",
                            password: "Haziqafendi@7189"
                        }
                    ]
                }
            })
        }
    });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/onboarding/preview",
        headers: { cookie: await createSessionCookie(actor) },
        payload: {
            mode: "manual",
            manualIdentity: {
                fullName: "Haziq Afendi",
                email: "haziq.afendi@jkseng.com",
                department: "Marketing"
            },
            selectedCatalogItemKeys: ["canva"]
        }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.previewToken, "preview-1");
    assert.equal(response.json().data.setupSheet.entries[0].systemId, "canva");
});

test("POST /api/v1/onboarding/confirm requires explicit confirmation", async () => {
    const actor = { id: randomUUID(), username: "it_user", role: "it", status: "active" };
    const app = await createTestApp({
        userRepo: {
            findUserByUsername: async (username) => (username === actor.username ? actor : null)
        },
        onboardingService: {
            confirmOnboardingSetup: async () => ({})
        }
    });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/onboarding/confirm",
        headers: { cookie: await createSessionCookie(actor) },
        payload: {
            previewToken: "preview-1",
            confirmed: false
        }
    });

    assert.equal(response.statusCode, 400);
});

test("GET /api/v1/onboarding/drafts lists saved manual drafts", async () => {
    const actor = { id: randomUUID(), username: "it_user", role: "it", status: "active" };
    const app = await createTestApp({
        userRepo: {
            findUserByUsername: async (username) => (username === actor.username ? actor : null)
        },
        onboardingService: {
            listOnboardingDrafts: async () => ([
                {
                    id: "draft-1",
                    fullName: "Haziq Afendi",
                    email: "haziq.afendi@jkseng.com",
                    department: "Business Development",
                    status: "draft"
                }
            ])
        }
    });

    const response = await app.inject({
        method: "GET",
        url: "/api/v1/onboarding/drafts",
        headers: { cookie: await createSessionCookie(actor) }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data[0].id, "draft-1");
});

test("POST /api/v1/onboarding/drafts/:id/link-and-promote links a draft and promotes credentials", async () => {
    const actor = { id: randomUUID(), username: "it_user", role: "it", status: "active" };
    const app = await createTestApp({
        userRepo: {
            findUserByUsername: async (username) => (username === actor.username ? actor : null)
        },
        onboardingService: {
            linkDraftToUserAndPromote: async (draftId, userId) => ({
                draft: {
                    id: draftId,
                    linkedUserId: userId,
                    status: "completed"
                },
                targetUser: {
                    id: userId,
                    username: "haziq.afendi"
                },
                promotedCredentials: [
                    {
                        systemId: "sigma",
                        username: "haziq.afendi"
                    }
                ]
            })
        }
    });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/onboarding/drafts/draft-1/link-and-promote",
        headers: { cookie: await createSessionCookie(actor) },
        payload: {
            userId: "user-1"
        }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.draft.status, "completed");
    assert.equal(response.json().data.targetUser.id, "user-1");
});
