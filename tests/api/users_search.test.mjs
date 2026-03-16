import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

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
    },
    ldapSync: {
        attributes: ["cn", "mail", "department"],
        usernameAttribute: "uid"
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

const createInMemoryUserRepo = (initialUsers = []) => {
    const users = new Map(initialUsers.map((user) => [user.id, user]));
    const usersByUsername = new Map(initialUsers.map((user) => [user.username, user]));

    return {
        findUserByUsername: async (username) => usersByUsername.get(username) ?? null,
        isUserDisabled: (user) => user?.status === "disabled",
        listUsers: async () => [...users.values()],
        findUserById: async (id) => users.get(id) ?? null,
        listUsersFiltered: async (filters = {}, pagination = {}) => {
            const { page = 1, perPage = 20 } = pagination;
            let filteredUsers = [...users.values()];

            // Text search across username, displayName, department
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                filteredUsers = filteredUsers.filter(user => {
                    const username = user.username?.toLowerCase() || '';
                    const displayName = user.ldapAttributes?.displayName?.toLowerCase() || '';
                    const department = user.ldapAttributes?.department?.toLowerCase() || '';

                    return username.includes(searchLower) ||
                        displayName.includes(searchLower) ||
                        department.includes(searchLower);
                });
            }

            // Role filter
            if (filters.role) {
                filteredUsers = filteredUsers.filter(user => user.role === filters.role);
            }

            // Status filter
            if (filters.status) {
                filteredUsers = filteredUsers.filter(user => user.status === filters.status);
            }

            // Sort
            filteredUsers.sort((a, b) => a.username.localeCompare(b.username));

            // Pagination
            const total = filteredUsers.length;
            const skip = (page - 1) * perPage;
            const data = filteredUsers.slice(skip, skip + perPage);

            return { data, total, page, perPage };
        }
    };
};

const createTestApp = async ({ userRepo, config } = {}) => {
    const app = Fastify({ logger: false });
    await app.register(cookie);
    await app.register(usersRoutes, {
        config: config ?? baseConfig,
        userRepo: userRepo ?? createInMemoryUserRepo()
    });
    await app.ready();
    return app;
};

// Test dataset
const testUsers = [
    {
        id: "user-1",
        username: "john.doe",
        role: "requester",
        status: "active",
        ldapAttributes: { displayName: "John Doe", department: "Engineering" }
    },
    {
        id: "user-2",
        username: "jane.smith",
        role: "it",
        status: "active",
        ldapAttributes: { displayName: "Jane Smith", department: "IT Support" }
    },
    {
        id: "user-3",
        username: "bob.jones",
        role: "admin",
        status: "disabled",
        ldapAttributes: { displayName: "Bob Jones", department: "Engineering" }
    },
    {
        id: "user-4",
        username: "alice.wong",
        role: "head",
        status: "active",
        ldapAttributes: { displayName: "Alice Wong", department: "Finance" }
    },
    {
        id: "user-5",
        username: "charlie.brown",
        role: "requester",
        status: "active",
        ldapAttributes: { displayName: "Charlie Brown", department: "Finance" }
    }
];

test("GET /users with search filter by username (case-insensitive)", async () => {
    const itUser = testUsers[1]; // jane.smith
    const app = await createTestApp({
        userRepo: createInMemoryUserRepo(testUsers)
    });

    const response = await app.inject({
        method: "GET",
        url: "/users?search=john",
        headers: {
            cookie: await createSessionCookie(itUser)
        }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(body.data);
    assert.ok(body.meta);
    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0].username, "john.doe");

    await app.close();
});

test("GET /users with search filter by displayName (case-insensitive)", async () => {
    const itUser = testUsers[1]; // jane.smith
    const app = await createTestApp({
        userRepo: createInMemoryUserRepo(testUsers)
    });

    const response = await app.inject({
        method: "GET",
        url: "/users?search=smith",
        headers: {
            cookie: await createSessionCookie(itUser)
        }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0].username, "jane.smith");

    await app.close();
});

test("GET /users with search filter by department", async () => {
    const itUser = testUsers[1]; // jane.smith
    const app = await createTestApp({
        userRepo: createInMemoryUserRepo(testUsers)
    });

    const response = await app.inject({
        method: "GET",
        url: "/users?search=engineering",
        headers: {
            cookie: await createSessionCookie(itUser)
        }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.meta.total, 2); // john.doe and bob.jones

    const usernames = body.data.map(u => u.username).sort();
    assert.deepEqual(usernames, ["bob.jones", "john.doe"]);

    await app.close();
});

test("GET /users with role filter", async () => {
    const itUser = testUsers[1]; // jane.smith
    const app = await createTestApp({
        userRepo: createInMemoryUserRepo(testUsers)
    });

    const response = await app.inject({
        method: "GET",
        url: "/users?role=requester",
        headers: {
            cookie: await createSessionCookie(itUser)
        }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.meta.total, 2); // john.doe and charlie.brown

    const usernames = body.data.map(u => u.username).sort();
    assert.deepEqual(usernames, ["charlie.brown", "john.doe"]);

    await app.close();
});

test("GET /users with status filter", async () => {
    const itUser = testUsers[1]; // jane.smith
    const app = await createTestApp({
        userRepo: createInMemoryUserRepo(testUsers)
    });

    const response = await app.inject({
        method: "GET",
        url: "/users?status=disabled",
        headers: {
            cookie: await createSessionCookie(itUser)
        }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0].username, "bob.jones");

    await app.close();
});

test("GET /users with combined filters (role AND status)", async () => {
    const itUser = testUsers[1]; // jane.smith
    const app = await createTestApp({
        userRepo: createInMemoryUserRepo(testUsers)
    });

    const response = await app.inject({
        method: "GET",
        url: "/users?role=requester&status=active",
        headers: {
            cookie: await createSessionCookie(itUser)
        }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.meta.total, 2);

    const usernames = body.data.map(u => u.username).sort();
    assert.deepEqual(usernames, ["charlie.brown", "john.doe"]);

    await app.close();
});

test("GET /users with search and filter combined", async () => {
    const itUser = testUsers[1]; // jane.smith
    const app = await createTestApp({
        userRepo: createInMemoryUserRepo(testUsers)
    });

    const response = await app.inject({
        method: "GET",
        url: "/users?search=finance&status=active",
        headers: {
            cookie: await createSessionCookie(itUser)
        }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.meta.total, 2); // alice.wong and charlie.brown from Finance dept with active status

    const usernames = body.data.map(u => u.username).sort();
    assert.deepEqual(usernames, ["alice.wong", "charlie.brown"]);

    await app.close();
});

test("GET /users with pagination", async () => {
    const itUser = testUsers[1]; // jane.smith
    const app = await createTestApp({
        userRepo: createInMemoryUserRepo(testUsers)
    });

    const response = await app.inject({
        method: "GET",
        url: "/users?page=1&perPage=2",
        headers: {
            cookie: await createSessionCookie(itUser)
        }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.meta.total, 5);
    assert.equal(body.meta.page, 1);
    assert.equal(body.meta.perPage, 2);
    assert.equal(body.data.length, 2);

    await app.close();
});

test("GET /users with no results returns empty array", async () => {
    const itUser = testUsers[1]; // jane.smith
    const app = await createTestApp({
        userRepo: createInMemoryUserRepo(testUsers)
    });

    const response = await app.inject({
        method: "GET",
        url: "/users?search=nonexistent",
        headers: {
            cookie: await createSessionCookie(itUser)
        }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.meta.total, 0);
    assert.deepEqual(body.data, []);

    await app.close();
});

test("GET /users requires authentication for search", async () => {
    const app = await createTestApp({
        userRepo: createInMemoryUserRepo(testUsers)
    });

    const response = await app.inject({
        method: "GET",
        url: "/users?search=john"
    });

    assert.equal(response.statusCode, 401);
    const body = response.json();
    assert.equal(body.title, "Unauthorized");

    await app.close();
});

test("GET /users forbids non-IT roles for filtered search", async () => {
    const requesterUser = testUsers[0]; // john.doe (requester)
    const app = await createTestApp({
        userRepo: createInMemoryUserRepo(testUsers)
    });

    const response = await app.inject({
        method: "GET",
        url: "/users?search=jane",
        headers: {
            cookie: await createSessionCookie(requesterUser)
        }
    });

    assert.equal(response.statusCode, 403);
    const body = response.json();
    assert.equal(body.title, "Forbidden");

    await app.close();
});
