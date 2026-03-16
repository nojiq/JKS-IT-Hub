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
let adminUser, itUser, requesterUser;
let adminToken, itToken, requesterToken;
let config;
let requestId;

test("Requests Approval API Endpoints", async (t) => {
    // Overall Setup
    await t.test("Setup", async () => {
        config = getAuthConfig();
        app = await build();

        // Create Admin User
        adminUser = await prisma.user.create({
            data: { username: `admin-api-${randomUUID()}`, role: "admin", status: "active" }
        });

        // Create IT User
        itUser = await prisma.user.create({
            data: { username: `it-api-${randomUUID()}`, role: "it", status: "active" }
        });

        // Create Requester User
        requesterUser = await prisma.user.create({
            data: { username: `req-api-${randomUUID()}`, role: "requester", status: "active" }
        });

        // Tokens
        adminToken = await signSessionToken({
            subject: adminUser.id,
            payload: { username: adminUser.username, role: adminUser.role }
        }, config.jwt);

        itToken = await signSessionToken({
            subject: itUser.id,
            payload: { username: itUser.username, role: itUser.role }
        }, config.jwt);

        requesterToken = await signSessionToken({
            subject: requesterUser.id,
            payload: { username: requesterUser.username, role: requesterUser.role }
        }, config.jwt);

        // Create Request
        const request = await prisma.itemRequest.create({
            data: {
                requesterId: requesterUser.id,
                itemName: "Approval API Test",
                description: "Desc",
                justification: "Just",
                priority: "MEDIUM",
                category: "Hardware",
                status: "IT_REVIEWED"
            }
        });
        requestId = request.id;
    });

    await t.test("POST /api/v1/requests/:id/approve - Success", async () => {
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/approve`,
            headers: { cookie: `it-hub-session=${adminToken}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.status, "APPROVED");
        assert.equal(body.data.approvedById, adminUser.id);
    });

    await t.test("POST /api/v1/requests/:id/approve - Forbidden (IT User)", async () => {
        // Reset status
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "IT_REVIEWED" } });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/approve`,
            headers: { cookie: `it-hub-session=${itToken}` }
        });

        assert.equal(response.statusCode, 403);
    });

    await t.test("POST /api/v1/requests/:id/approve - Forbidden (Requester)", async () => {
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/approve`,
            headers: { cookie: `it-hub-session=${requesterToken}` }
        });

        assert.equal(response.statusCode, 403);
    });

    await t.test("POST /api/v1/requests/:id/approve - Bad Request (Wrong Status)", async () => {
        // Set to SUBMITTED
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "SUBMITTED" } });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/approve`,
            headers: { cookie: `it-hub-session=${adminToken}` }
        });

        assert.equal(response.statusCode, 400);
    });

    await t.test("POST /api/v1/requests/:id/approve - Not Found", async () => {
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${randomUUID()}/approve`,
            headers: { cookie: `it-hub-session=${adminToken}` }
        });

        assert.equal(response.statusCode, 404);
    });

    // Cleanup
    await t.test("Cleanup", async () => {
        if (requestId) await prisma.itemRequest.delete({ where: { id: requestId } });
        if (adminUser) await prisma.user.delete({ where: { id: adminUser.id } });
        if (itUser) await prisma.user.delete({ where: { id: itUser.id } });
        if (requesterUser) await prisma.user.delete({ where: { id: requesterUser.id } });
        await prisma.$disconnect();
        await app.close();
    });
});
