/* eslint-disable */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");

import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";
import { getAuthConfig } from "../../apps/api/src/config/authConfig.js";
import appPlugin from "../../apps/api/src/server.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

async function build() {
    const app = Fastify();
    await app.register(appPlugin);
    return app;
}

let app;
let itUser, requesterUser;
let itToken, requesterToken;
let config;

before(async () => {
    config = getAuthConfig();
    app = await build();

    // Create IT User
    itUser = await prisma.user.create({
        data: {
            username: `it-maint-${randomUUID()}`,
            role: "it",
            status: "active"
        }
    });

    // Create Requester User
    requesterUser = await prisma.user.create({
        data: {
            username: `req-maint-${randomUUID()}`,
            role: "requester",
            status: "active"
        }
    });

    // Tokens
    itToken = await signSessionToken({
        subject: itUser.id,
        payload: { username: itUser.username, role: itUser.role }
    }, config.jwt);

    requesterToken = await signSessionToken({
        subject: requesterUser.id,
        payload: { username: requesterUser.username, role: requesterUser.role }
    }, config.jwt);
});

after(async () => {
    await prisma.$disconnect();
    await app.close();
});

test("Maintenance Features - RBAC & Functionality", async (t) => {

    let cycleId;

    await t.test("1. IT User can create maintenance cycle", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/cycles",
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                name: "Test Cycle Quarterly",
                intervalMonths: 3,
                description: "Quarterly checks"
            }
        });

        assert.equal(response.statusCode, 201, "Should return 201 Created");
        const body = JSON.parse(response.body);
        assert.ok(body.data.id, "Should have cycle ID");
        assert.equal(body.data.name, "Test Cycle Quarterly");

        cycleId = body.data.id;
    });

    await t.test("2. Requester User CANNOT create maintenance cycle", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/cycles",
            headers: { cookie: `it-hub-session=${requesterToken}` },
            payload: {
                name: "Requester Cycle",
                intervalMonths: 1
            }
        });

        assert.equal(response.statusCode, 403, "Should return 403 Forbidden");
    });

    await t.test("3. IT User can update maintenance cycle", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/maintenance/cycles/${cycleId}`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                description: "Updated description"
            }
        });

        assert.equal(response.statusCode, 200, "Should return 200 OK");
        const body = JSON.parse(response.body);
        assert.equal(body.data.description, "Updated description");
    });

    await t.test("4. Requester User CANNOT update maintenance cycle", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/maintenance/cycles/${cycleId}`,
            headers: { cookie: `it-hub-session=${requesterToken}` },
            payload: {
                description: "Hacked"
            }
        });

        assert.equal(response.statusCode, 403, "Should return 403 Forbidden");
    });

    await t.test("5. IT User can generate schedule", async () => {
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/cycles/${cycleId}/generate-schedule`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: { monthsAhead: 12 }
        });

        assert.equal(response.statusCode, 200, "Should return 200 OK");
        const body = JSON.parse(response.body);
        assert.ok(body.data.generated > 0, "Should have generated windows");
        assert.ok(body.data.windows.length > 0, "Windows array should not be empty");
        assert.equal(body.data.windows[0].status, "SCHEDULED");
    });

    await t.test("6. Requester User CANNOT generate schedule", async () => {
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/cycles/${cycleId}/generate-schedule`,
            headers: { cookie: `it-hub-session=${requesterToken}` },
            payload: { monthsAhead: 12 }
        });

        assert.equal(response.statusCode, 403);
    });

    await t.test("7. IT User can list windows", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/v1/maintenance/windows?cycleId=${cycleId}`,
            headers: { cookie: `it-hub-session=${itToken}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.ok(body.data.length > 0, "Should list windows");
    });

    await t.test("8. IT User can cancel a window", async () => {
        // Get a window ID first
        const listResponse = await app.inject({
            method: "GET",
            url: `/api/v1/maintenance/windows?cycleId=${cycleId}`,
            headers: { cookie: `it-hub-session=${itToken}` }
        });
        const windows = JSON.parse(listResponse.body).data;
        const windowId = windows[0].id;

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/windows/${windowId}/cancel`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: { reason: "Testing cancellation" }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.status, "CANCELLED");
    });
});
