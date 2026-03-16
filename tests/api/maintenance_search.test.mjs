
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");

import maintenanceRoutes from "../../apps/api/src/features/maintenance/routes.js";
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

const createInMemoryMaintenanceRepo = (initialWindows = []) => {
    const windows = initialWindows;

    return {
        listMaintenanceWindows: async (filters = {}) => {
            const { page = 1, limit = 50 } = filters;
            let filteredWindows = [...windows];

            // Filter by Cycle ID
            if (filters.cycleId) {
                filteredWindows = filteredWindows.filter(w => w.cycleConfigId === filters.cycleId);
            }

            // Filter by Status
            if (filters.status) {
                const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
                filteredWindows = filteredWindows.filter(w => statuses.includes(w.status));
            }

            // Filter by Device Type
            if (filters.deviceType) {
                // Mock implementation assumes filteredWindows have deviceTypes array
                filteredWindows = filteredWindows.filter(w =>
                    w.deviceTypes && w.deviceTypes.some(dt => dt.deviceType === filters.deviceType)
                );
            }

            // Filter by Date Range
            if (filters.scheduledStartDateGte) {
                filteredWindows = filteredWindows.filter(w => new Date(w.scheduledStartDate) >= new Date(filters.scheduledStartDateGte));
            }
            if (filters.scheduledStartDateLte) {
                filteredWindows = filteredWindows.filter(w => new Date(w.scheduledStartDate) <= new Date(filters.scheduledStartDateLte));
            }

            // Filter by Assignee ID
            if (filters.assignedToId) { // Changed from assignedTo to assignedToId to match likely implementation
                filteredWindows = filteredWindows.filter(w => w.assignedToId === filters.assignedToId);
            }

            // Search (Mock implementation)
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                filteredWindows = filteredWindows.filter(w => {
                    const cycleName = w.cycleConfig?.name?.toLowerCase() || '';
                    const assignee = w.assignedTo?.username?.toLowerCase() || '';
                    // Check device types names
                    const hasDeviceType = w.deviceTypes?.some(dt => dt.deviceType.toLowerCase().includes(searchLower));

                    return cycleName.includes(searchLower) ||
                        assignee.includes(searchLower) ||
                        hasDeviceType;
                });
            }

            // Sort
            filteredWindows.sort((a, b) => new Date(a.scheduledStartDate) - new Date(b.scheduledStartDate));

            // Pagination
            const total = filteredWindows.length;
            const skip = (page - 1) * limit;
            const data = filteredWindows.slice(skip, skip + limit);

            return { windows: data, total, page, limit };
        },
        // Mock other required methods for routes to function if called
        getMaintenanceWindowsByCycleId: async () => ({ data: [], meta: {} })
    };
};

// Mock Service to bypass Repo
const createMockMaintenanceService = (repo) => {
    return {
        getMaintenanceWindows: async (filters, actor) => {
            // Mimic service logic calling repo.listMaintenanceWindows
            // We need to conform to what current service does: parse schema then call repo
            // But for tests we can just call repo directly if we trust service logic, 
            // OR we can implement the service logic here.
            // Given we are testing API params -> Route -> Service -> Repo, we should verify filters are passed correctly.

            // Simple mapping
            const mappedFilters = {
                ...filters,
                limit: filters.perPage,
                // Map dateFrom/dateTo to repo specific keys if needed
                scheduledStartDateGte: filters.startDateFrom,
                scheduledStartDateLte: filters.startDateTo,
                assignedToId: filters.assignedTo
            };

            const result = await repo.listMaintenanceWindows(mappedFilters);
            return {
                data: result.windows,
                meta: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: Math.ceil(result.total / result.limit)
                }
            };
        }
    };
};


const testWindows = [
    {
        id: "win-1",
        cycleConfigId: "cycle-1",
        cycleConfig: { name: "Weekly Server Patching" },
        status: "SCHEDULED",
        scheduledStartDate: "2026-05-01T10:00:00Z",
        deviceTypes: [{ deviceType: "SERVER" }],
        assignedToId: "user-2",
        assignedTo: { username: "jane.smith" }
    },
    {
        id: "win-2",
        cycleConfigId: "cycle-2",
        cycleConfig: { name: "Laptop Refresh" },
        status: "COMPLETED",
        scheduledStartDate: "2026-04-15T09:00:00Z",
        deviceTypes: [{ deviceType: "LAPTOP" }],
        assignedToId: "user-1",
        assignedTo: { username: "john.doe" }
    },
    {
        id: "win-3",
        cycleConfigId: "cycle-1", // Same cycle as win-1
        cycleConfig: { name: "Weekly Server Patching" },
        status: "OVERDUE",
        scheduledStartDate: "2026-04-01T10:00:00Z",
        deviceTypes: [{ deviceType: "SERVER" }, { deviceType: "DESKTOP_PC" }],
        assignedToId: null,
        assignedTo: null
    }
];

const testUser = {
    id: "user-99",
    username: "admin",
    role: "admin",
    status: "active"
};

const setupApp = async () => {
    const repo = createInMemoryMaintenanceRepo(testWindows);
    const service = createMockMaintenanceService(repo);

    // Mock userRepo for requireAuthenticated
    const userRepo = {
        findUserByUsername: async (username) => {
            if (username === testUser.username) return testUser;
            return null;
        },
        isUserDisabled: (user) => user.status === 'disabled'
    };

    const app = Fastify({ logger: false });
    await app.register(cookie);
    await app.register(maintenanceRoutes, {
        config: baseConfig,
        userRepo: userRepo,
        maintenanceService: service
    });

    return app;
};

test("GET /windows with search by cycle name", async () => {
    const app = await setupApp();
    const response = await app.inject({
        method: "GET",
        url: "/windows?search=weekly",
        headers: { cookie: await createSessionCookie(testUser) }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.meta.total, 2); // win-1 and win-3
    assert.ok(body.data.find(w => w.id === "win-1"));
    assert.ok(body.data.find(w => w.id === "win-3"));
});

test("GET /windows with search by assignee", async () => {
    const app = await setupApp();
    const response = await app.inject({
        method: "GET",
        url: "/windows?search=jane",
        headers: { cookie: await createSessionCookie(testUser) }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0].id, "win-1");
});

test("GET /windows with search by device type", async () => {
    const app = await setupApp();
    const response = await app.inject({
        method: "GET",
        url: "/windows?search=laptop",
        headers: { cookie: await createSessionCookie(testUser) }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0].id, "win-2");
});

test("GET /windows with status filter", async () => {
    const app = await setupApp();
    const response = await app.inject({
        method: "GET",
        url: "/windows?status=OVERDUE",
        headers: { cookie: await createSessionCookie(testUser) }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0].id, "win-3");
});

test("GET /windows with date range filter", async () => {
    const app = await setupApp();
    const response = await app.inject({
        method: "GET",
        url: "/windows?startDateFrom=2026-04-30T00:00:00Z",
        headers: { cookie: await createSessionCookie(testUser) }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    // Should match win-1 (May 1st)
    // win-2 is April 15, win-3 is April 1
    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0].id, "win-1");
});

test("GET /windows with assignedTo filter", async () => {
    const app = await setupApp();
    const response = await app.inject({
        method: "GET",
        url: "/windows?assignedTo=user-1",
        headers: { cookie: await createSessionCookie(testUser) }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0].id, "win-2");
});
