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

const createTestApp = async ({ userRepo, onboardingService, pulseOrgClient } = {}) => {
    const { default: onboardingRoutes } = await import("../../apps/api/src/features/onboarding/routes.js");
    const app = Fastify({ logger: false });
    await app.register(cookie);
    await app.register(onboardingRoutes, {
        prefix: "/api/v1/onboarding",
        config: baseConfig,
        userRepo,
        onboardingService,
        pulseOrgClient
    });
    await app.ready();
    return app;
};

test("GET /api/v1/onboarding/catalog-items lists catalog items for IT", async () => {
    const actor = { id: randomUUID(), username: "it_user", role: "dev", status: "active" };
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

test("GET /api/v1/onboarding/pulse-org-hierarchy returns JKSPulse org tree", async () => {
    const actor = { id: randomUUID(), username: "it_user", role: "dev", status: "active" };
    const app = await createTestApp({
        userRepo: {
            findUserByUsername: async (username) => (username === actor.username ? actor : null)
        },
        onboardingService: {},
        pulseOrgClient: {
            listOrgHierarchy: async () => ({
                enabled: true,
                divisions: [{ id: "div-1", name: "Operations" }],
                departments: [{ id: "dept-1", divisionId: "div-1", name: "Production" }],
                sections: [{ id: "sec-1", departmentId: "dept-1", name: "Line A" }]
            })
        }
    });

    const response = await app.inject({
        method: "GET",
        url: "/api/v1/onboarding/pulse-org-hierarchy",
        headers: { cookie: await createSessionCookie(actor) }
    });

    assert.equal(response.statusCode, 200);
    const data = response.json().data;
    assert.equal(data.enabled, true);
    assert.equal(data.divisions[0].name, "Operations");
    assert.equal(data.departments[0].name, "Production");
    assert.equal(data.sections[0].name, "Line A");
});

test("GET /api/v1/onboarding/pulse-org-hierarchy returns disabled tree when Mongo fails", async () => {
    const actor = { id: randomUUID(), username: "it_user", role: "dev", status: "active" };
    const app = await createTestApp({
        userRepo: {
            findUserByUsername: async (username) => (username === actor.username ? actor : null)
        },
        onboardingService: {},
        pulseOrgClient: {
            listOrgHierarchy: async () => {
                const err = new Error("Command find requires authentication");
                err.code = 13;
                err.codeName = "Unauthorized";
                throw err;
            }
        }
    });

    const response = await app.inject({
        method: "GET",
        url: "/api/v1/onboarding/pulse-org-hierarchy",
        headers: { cookie: await createSessionCookie(actor) }
    });

    assert.equal(response.statusCode, 200);
    const data = response.json().data;
    assert.equal(data.enabled, false);
    assert.deepEqual(data.divisions, []);
    assert.deepEqual(data.departments, []);
    assert.deepEqual(data.sections, []);
});

test("POST /api/v1/onboarding/department-bundles creates a department bundle", async () => {
    const actor = { id: randomUUID(), username: "it_user", role: "dev", status: "active" };
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
    const actor = { id: randomUUID(), username: "it_user", role: "dev", status: "active" };
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
                department: "Marketing",
                dob: "1990-05-01"
            },
            selectedCatalogItemKeys: ["canva"]
        }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.previewToken, "preview-1");
    assert.equal(response.json().data.setupSheet.entries[0].systemId, "canva");
});

test("POST /api/v1/onboarding/preview accepts manual body with only name, email, dob and no catalog keys", async () => {
    const actor = { id: randomUUID(), username: "it_user", role: "dev", status: "active" };
    const app = await createTestApp({
        userRepo: {
            findUserByUsername: async (username) => (username === actor.username ? actor : null)
        },
        onboardingService: {
            previewOnboardingSetup: async () => ({
                previewToken: "preview-min",
                source: { mode: "manual", department: "" },
                recommendedItemKeys: [],
                setupSheet: { entries: [] }
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
                fullName: "Min User",
                email: "min.user@jkseng.com",
                dob: "1999-11-22"
            },
            selectedCatalogItemKeys: []
        }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.previewToken, "preview-min");
});

test("POST /api/v1/onboarding/preview accepts existing-user body without catalog keys", async () => {
    const actor = { id: randomUUID(), username: "it_user", role: "dev", status: "active" };
    const app = await createTestApp({
        userRepo: {
            findUserByUsername: async (username) => (username === actor.username ? actor : null)
        },
        onboardingService: {
            previewOnboardingSetup: async () => ({
                previewToken: "preview-existing-min",
                source: { mode: "existing_user", userId: "00000000-0000-0000-0000-000000000001" },
                recommendedItemKeys: [],
                setupSheet: { entries: [] }
            })
        }
    });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/onboarding/preview",
        headers: { cookie: await createSessionCookie(actor) },
        payload: {
            mode: "existing_user",
            userId: "00000000-0000-0000-0000-000000000001",
            selectedCatalogItemKeys: []
        }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.previewToken, "preview-existing-min");
});

test("POST /api/v1/onboarding/confirm requires explicit confirmation", async () => {
    const actor = { id: randomUUID(), username: "it_user", role: "dev", status: "active" };
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
    const actor = { id: randomUUID(), username: "it_user", role: "dev", status: "active" };
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
    const actor = { id: randomUUID(), username: "it_user", role: "dev", status: "active" };
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
