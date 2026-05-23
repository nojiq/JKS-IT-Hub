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
import { createLegacyItemRequest } from "./helpers/legacyItemRequest.mjs";

const itemRequest = createLegacyItemRequest(prisma);

async function build() {
    const app = Fastify();
    await app.register(appPlugin);
    return app;
}

let app;
let adminUser, devUser, itUser, requesterUser;
let adminToken, devToken, itToken, requesterToken;
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

        devUser = await prisma.user.create({
            data: { username: `dev-api-${randomUUID()}`, role: "dev", status: "active" }
        });

        // Create IT User
        itUser = await prisma.user.create({
            data: { username: `it-api-${randomUUID()}`, role: "it", status: "active" }
        });

        // Create User Role
        requesterUser = await prisma.user.create({
            data: { username: `req-api-${randomUUID()}`, role: "user", status: "active" }
        });

        // Tokens
        adminToken = await signSessionToken({
            subject: adminUser.id,
            payload: { username: adminUser.username, role: adminUser.role }
        }, config.jwt);

        devToken = await signSessionToken({
            subject: devUser.id,
            payload: { username: devUser.username, role: devUser.role }
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
        const request = await itemRequest.create({
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
            headers: { cookie: `it-hub-session=${devToken}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.status, "APPROVED");
        assert.equal(body.data.approvedById, devUser.id);
    });

    await t.test("POST /api/v1/requests/:id/approve - Admin User Success", async () => {
        await itemRequest.update({ where: { id: requestId }, data: { status: "IT_REVIEWED" } });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/approve`,
            headers: { cookie: `it-hub-session=${adminToken}` }
        });

        assert.equal(response.statusCode, 200);
        assert.equal(JSON.parse(response.body).data.approvedById, adminUser.id);
    });

    await t.test("POST /api/v1/requests/:id/approve - IT User Success", async () => {
        // Reset status
        await itemRequest.update({ where: { id: requestId }, data: { status: "IT_REVIEWED" } });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/approve`,
            headers: { cookie: `it-hub-session=${itToken}` }
        });

        assert.equal(response.statusCode, 200);
        assert.equal(JSON.parse(response.body).data.approvedById, itUser.id);
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
        await itemRequest.update({ where: { id: requestId }, data: { status: "SUBMITTED" } });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/approve`,
            headers: { cookie: `it-hub-session=${devToken}` }
        });

        assert.equal(response.statusCode, 400);
    });

    await t.test("POST /api/v1/requests/:id/approve - Not Found", async () => {
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${randomUUID()}/approve`,
            headers: { cookie: `it-hub-session=${devToken}` }
        });

        assert.equal(response.statusCode, 404);
    });

    // Cleanup
    await t.test("Cleanup", async () => {
        const userIds = [adminUser, devUser, itUser, requesterUser].map((user) => user?.id).filter(Boolean);
        if (requestId) {
            await prisma.inAppNotification.deleteMany({ where: { referenceId: requestId } });
            await prisma.emailNotification.deleteMany({ where: { referenceId: requestId } });
            await prisma.auditLog.deleteMany({ where: { entityId: requestId } });
            await itemRequest.delete({ where: { id: requestId } });
        }
        if (userIds.length) {
            await prisma.inAppNotification.deleteMany({ where: { userId: { in: userIds } } });
            await prisma.emailNotification.deleteMany({ where: { recipientUserId: { in: userIds } } });
            await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
            await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
        await prisma.$disconnect();
        await app.close();
    });
});
