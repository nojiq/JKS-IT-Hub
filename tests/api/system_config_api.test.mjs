import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";
import appPlugin from "../../apps/api/src/server.js";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";
import { getAuthConfig } from "../../apps/api/src/config/authConfig.js";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");

async function build() {
    const app = Fastify();
    await app.register(appPlugin);
    return app;
}

const uniqueSystemId = (prefix) => `${prefix}-${randomUUID().slice(0, 8)}`;

let app;
let authToken;
let testUser;
let config;

const createAuthToken = async (user) => {
    return signSessionToken({
        subject: user.id,
        payload: {
            username: user.username,
            role: user.role
        }
    }, config.jwt);
};

before(async () => {
    config = getAuthConfig();
    app = await build();
    
    // Create a test IT user and login
    testUser = await prisma.user.create({
        data: {
            username: `api-test-${randomUUID()}`,
            role: "it"
        }
    });

    authToken = await createAuthToken(testUser);
});

after(async () => {
    await prisma.$disconnect();
    await app.close();
});

test("System Config API - Create (POST /api/v1/system-configs)", async (t) => {
    await t.test("creates system config with valid data", async () => {
        const systemId = uniqueSystemId("api-test-email");
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/system-configs",
            headers: {
                cookie: `it-hub-session=${authToken}`
            },
            payload: {
                systemId,
                usernameLdapField: "mail",
                description: "API test email system"
            }
        });

        assert.equal(response.statusCode, 201);
        const body = JSON.parse(response.body);
        assert.ok(body.data);
        assert.equal(body.data.systemId, systemId);
        assert.equal(body.data.usernameLdapField, "mail");
    });

    await t.test("returns 400 for invalid systemId format", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/system-configs",
            headers: {
                cookie: `it-hub-session=${authToken}`
            },
            payload: {
                systemId: "InvalidFormat",
                usernameLdapField: "mail"
            }
        });

        assert.equal(response.statusCode, 400);
        const body = JSON.parse(response.body);
        assert.ok(body.detail || body.title);
    });

    await t.test("returns 409 for duplicate systemId", async () => {
        const systemId = uniqueSystemId("api-duplicate-test");
        // Create first
        await app.inject({
            method: "POST",
            url: "/api/v1/system-configs",
            headers: {
                cookie: `it-hub-session=${authToken}`
            },
            payload: {
                systemId,
                usernameLdapField: "mail"
            }
        });

        // Try to create duplicate
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/system-configs",
            headers: {
                cookie: `it-hub-session=${authToken}`
            },
            payload: {
                systemId,
                usernameLdapField: "uid"
            }
        });

        assert.equal(response.statusCode, 409);
    });

    await t.test("returns 400 for non-existent LDAP field", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/system-configs",
            headers: {
                cookie: `it-hub-session=${authToken}`
            },
            payload: {
                systemId: uniqueSystemId("api-bad-ldap"),
                usernameLdapField: "nonExistentFieldXYZ"
            }
        });

        assert.equal(response.statusCode, 400);
        const body = JSON.parse(response.body);
        assert.ok(body.type?.includes("ldap-field-not-found") || body.title?.includes("LDAP"));
    });

    await t.test("returns 403 for non-IT users", async () => {
        // Create a non-IT user
        const regularUser = await prisma.user.create({
            data: {
                username: `regular-${randomUUID()}`,
                role: "requester"
            }
        });

        const regularToken = await createAuthToken(regularUser);

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/system-configs",
            headers: {
                cookie: `it-hub-session=${regularToken}`
            },
            payload: {
                systemId: uniqueSystemId("unauthorized-test"),
                usernameLdapField: "mail"
            }
        });

        assert.equal(response.statusCode, 403);
    });
});

test("System Config API - List (GET /api/v1/system-configs)", async (t) => {
    await t.test("returns list of system configs", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/system-configs",
            headers: {
                cookie: `it-hub-session=${authToken}`
            }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.ok(Array.isArray(body.data));
        assert.ok(body.meta?.count !== undefined);
    });

    await t.test("returns 403 for non-IT users", async () => {
        // Tested in create section, but good to verify for list too
        const regularUser = await prisma.user.create({
            data: {
                username: `regular-list-${randomUUID()}`,
                role: "requester"
            }
        });

        const regularToken = await createAuthToken(regularUser);

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/system-configs",
            headers: {
                cookie: `it-hub-session=${regularToken}`
            }
        });

        assert.equal(response.statusCode, 403);
    });
});

test("System Config API - Get Single (GET /api/v1/system-configs/:systemId)", async (t) => {
    const systemId = uniqueSystemId("api-get-test");
    // Create a config first
    await app.inject({
        method: "POST",
        url: "/api/v1/system-configs",
        headers: {
            cookie: `it-hub-session=${authToken}`
        },
        payload: {
            systemId,
            usernameLdapField: "mail"
        }
    });

    await t.test("returns single system config", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/v1/system-configs/${systemId}`,
            headers: {
                cookie: `it-hub-session=${authToken}`
            }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.systemId, systemId);
    });

    await t.test("returns 404 for non-existent system", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/system-configs/non-existent-system-12345",
            headers: {
                cookie: `it-hub-session=${authToken}`
            }
        });

        assert.equal(response.statusCode, 404);
    });
});

test("System Config API - Update (PUT /api/v1/system-configs/:systemId)", async (t) => {
    const systemId = uniqueSystemId("api-update-test");
    // Create a config first
    await app.inject({
        method: "POST",
        url: "/api/v1/system-configs",
        headers: {
            cookie: `it-hub-session=${authToken}`
        },
        payload: {
            systemId,
            usernameLdapField: "mail",
            description: "Original"
        }
    });

    await t.test("updates system config", async () => {
        const response = await app.inject({
            method: "PUT",
            url: `/api/v1/system-configs/${systemId}`,
            headers: {
                cookie: `it-hub-session=${authToken}`
            },
            payload: {
                description: "Updated description"
            }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.description, "Updated description");
    });

    await t.test("returns 404 for non-existent system", async () => {
        const response = await app.inject({
            method: "PUT",
            url: "/api/v1/system-configs/non-existent-update",
            headers: {
                cookie: `it-hub-session=${authToken}`
            },
            payload: {
                description: "Wont work"
            }
        });

        assert.equal(response.statusCode, 404);
    });

    await t.test("returns 400 for invalid LDAP field", async () => {
        const response = await app.inject({
            method: "PUT",
            url: `/api/v1/system-configs/${systemId}`,
            headers: {
                cookie: `it-hub-session=${authToken}`
            },
            payload: {
                usernameLdapField: "invalidField"
            }
        });

        assert.equal(response.statusCode, 400);
    });
});

test("System Config API - Delete (DELETE /api/v1/system-configs/:systemId)", async (t) => {
    const deleteSystemId = uniqueSystemId("api-delete-test");
    // Create a config first
    await app.inject({
        method: "POST",
        url: "/api/v1/system-configs",
        headers: {
            cookie: `it-hub-session=${authToken}`
        },
        payload: {
            systemId: deleteSystemId,
            usernameLdapField: "mail"
        }
    });

    await t.test("deletes unused system config", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/system-configs/${deleteSystemId}`,
            headers: {
                cookie: `it-hub-session=${authToken}`
            }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.success, true);
    });

    await t.test("returns 404 for non-existent system", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: "/api/v1/system-configs/non-existent-delete",
            headers: {
                cookie: `it-hub-session=${authToken}`
            }
        });

        assert.equal(response.statusCode, 404);
    });

    await t.test("returns 409 when system in use", async () => {
        const blockedSystemId = uniqueSystemId("api-delete-blocked");
        await app.inject({
            method: "POST",
            url: "/api/v1/system-configs",
            headers: {
                cookie: `it-hub-session=${authToken}`
            },
            payload: {
                systemId: blockedSystemId,
                usernameLdapField: "mail"
            }
        });

        const targetUser = await prisma.user.create({
            data: {
                username: `blocked-owner-${randomUUID()}`,
                role: "requester"
            }
        });

        await prisma.userCredential.create({
            data: {
                userId: targetUser.id,
                systemId: blockedSystemId,
                username: "blocked-owner@example.test",
                password: "secret",
                templateVersion: 1,
                generatedBy: testUser.id
            }
        });

        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/system-configs/${blockedSystemId}`,
            headers: {
                cookie: `it-hub-session=${authToken}`
            }
        });

        assert.equal(response.statusCode, 409);
        const body = JSON.parse(response.body);
        assert.equal(body.type, "/problems/system-in-use");
        assert.equal(body.credentialCount, 1);
        assert.ok(Array.isArray(body.affectedUsers));
        assert.equal(body.affectedUsers[0]?.id, targetUser.id);
    });
});

test("System Config API - LDAP Fields (GET /api/v1/system-configs/ldap-fields/available)", async (t) => {
    await t.test("returns available LDAP fields", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/system-configs/ldap-fields/available",
            headers: {
                cookie: `it-hub-session=${authToken}`
            }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.ok(Array.isArray(body.data));
        assert.ok(body.meta?.count !== undefined);
    });

    await t.test("returns 403 for non-IT users", async () => {
        const regularUser = await prisma.user.create({
            data: {
                username: `regular-ldap-${randomUUID()}`,
                role: "requester"
            }
        });

        const regularToken = await createAuthToken(regularUser);

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/system-configs/ldap-fields/available",
            headers: {
                cookie: `it-hub-session=${regularToken}`
            }
        });

        assert.equal(response.statusCode, 403);
    });
});

test("System Config API - Error Format (RFC 9457)", async (t) => {
    await t.test("returns RFC 9457 formatted errors", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/system-configs",
            headers: {
                cookie: `it-hub-session=${authToken}`
            },
            payload: {
                // Invalid payload - missing required fields
                systemId: "test"
            }
        });

        assert.equal(response.statusCode, 400);
        const body = JSON.parse(response.body);
        // RFC 9457 format should have these fields
        assert.ok(body.status);
        assert.ok(body.title);
        assert.ok(body.detail);
    });
});
