import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { build } from "../../apps/api/src/app.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

let app;
let authToken;
let testUser;

before(async () => {
    app = await build();
    
    // Create a test IT user and login
    testUser = await prisma.user.create({
        data: {
            username: `api-test-${randomUUID()}`,
            role: "it"
        }
    });

    // Login to get auth token
    const loginResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
            username: testUser.username,
            password: "test-password" // This will need to be mocked or use test credentials
        }
    });

    // Note: In real tests, we'd need to handle LDAP authentication
    // For now, we'll create a session directly
    const sessionResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/test-session",
        payload: {
            userId: testUser.id
        }
    });
    
    if (sessionResponse.statusCode === 200) {
        const cookies = sessionResponse.cookies;
        authToken = cookies?.find(c => c.name === "it-hub-session")?.value;
    }
});

after(async () => {
    await prisma.$disconnect();
    await app.close();
});

test("System Config API - Create (POST /api/v1/system-configs)", async (t) => {
    await t.test("creates system config with valid data", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/system-configs",
            headers: {
                cookie: `it-hub-session=${authToken}`
            },
            payload: {
                systemId: "api-test-email",
                usernameLdapField: "mail",
                description: "API test email system"
            }
        });

        assert.equal(response.statusCode, 201);
        const body = JSON.parse(response.body);
        assert.ok(body.data);
        assert.equal(body.data.systemId, "api-test-email");
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
        // Create first
        await app.inject({
            method: "POST",
            url: "/api/v1/system-configs",
            headers: {
                cookie: `it-hub-session=${authToken}`
            },
            payload: {
                systemId: "api-duplicate-test",
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
                systemId: "api-duplicate-test",
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
                systemId: "api-bad-ldap",
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

        const sessionResponse = await app.inject({
            method: "POST",
            url: "/api/v1/auth/test-session",
            payload: {
                userId: regularUser.id
            }
        });

        const regularToken = sessionResponse.cookies?.find(c => c.name === "it-hub-session")?.value;

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/system-configs",
            headers: {
                cookie: `it-hub-session=${regularToken}`
            },
            payload: {
                systemId: "unauthorized-test",
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

        const sessionResponse = await app.inject({
            method: "POST",
            url: "/api/v1/auth/test-session",
            payload: {
                userId: regularUser.id
            }
        });

        const regularToken = sessionResponse.cookies?.find(c => c.name === "it-hub-session")?.value;

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
    // Create a config first
    await app.inject({
        method: "POST",
        url: "/api/v1/system-configs",
        headers: {
            cookie: `it-hub-session=${authToken}`
        },
        payload: {
            systemId: "api-get-test",
            usernameLdapField: "mail"
        }
    });

    await t.test("returns single system config", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/system-configs/api-get-test",
            headers: {
                cookie: `it-hub-session=${authToken}`
            }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.systemId, "api-get-test");
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
    // Create a config first
    await app.inject({
        method: "POST",
        url: "/api/v1/system-configs",
        headers: {
            cookie: `it-hub-session=${authToken}`
        },
        payload: {
            systemId: "api-update-test",
            usernameLdapField: "mail",
            description: "Original"
        }
    });

    await t.test("updates system config", async () => {
        const response = await app.inject({
            method: "PUT",
            url: "/api/v1/system-configs/api-update-test",
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
            url: "/api/v1/system-configs/api-update-test",
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
    // Create a config first
    await app.inject({
        method: "POST",
        url: "/api/v1/system-configs",
        headers: {
            cookie: `it-hub-session=${authToken}`
        },
        payload: {
            systemId: "api-delete-test",
            usernameLdapField: "mail"
        }
    });

    await t.test("deletes unused system config", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: "/api/v1/system-configs/api-delete-test",
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
        // This test would require creating a credential that uses the system
        // Skipping for now as it requires credential service integration
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

        const sessionResponse = await app.inject({
            method: "POST",
            url: "/api/v1/auth/test-session",
            payload: {
                userId: regularUser.id
            }
        });

        const regularToken = sessionResponse.cookies?.find(c => c.name === "it-hub-session")?.value;

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
