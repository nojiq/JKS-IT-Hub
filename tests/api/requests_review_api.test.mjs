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
let itUser, adminUser, headItUser, requesterUser;
let itToken, adminToken, headItToken, requesterToken;
let config;
let requestId;

before(async () => {
    config = getAuthConfig();
    app = await build();

    // Create IT User
    itUser = await prisma.user.create({
        data: {
            username: `it-review-${randomUUID()}`,
            role: "it",
            status: "active"
        }
    });
    adminUser = await prisma.user.create({
        data: {
            username: `admin-review-${randomUUID()}`,
            role: "admin",
            status: "active"
        }
    });
    headItUser = await prisma.user.create({
        data: {
            username: `headit-review-${randomUUID()}`,
            role: "head_it",
            status: "active"
        }
    });

    // Create Requester User
    requesterUser = await prisma.user.create({
        data: {
            username: `req-review-${randomUUID()}`,
            role: "requester",
            status: "active"
        }
    });

    // Tokens
    itToken = await signSessionToken({
        subject: itUser.id,
        payload: { username: itUser.username, role: itUser.role }
    }, config.jwt);
    adminToken = await signSessionToken({
        subject: adminUser.id,
        payload: { username: adminUser.username, role: adminUser.role }
    }, config.jwt);
    headItToken = await signSessionToken({
        subject: headItUser.id,
        payload: { username: headItUser.username, role: headItUser.role }
    }, config.jwt);

    requesterToken = await signSessionToken({
        subject: requesterUser.id,
        payload: { username: requesterUser.username, role: requesterUser.role }
    }, config.jwt);

    // Create Request
    const request = await prisma.itemRequest.create({
        data: {
            requesterId: requesterUser.id,
            itemName: "Review API Test",
            description: "Desc",
            justification: "Just",
            priority: "MEDIUM",
            category: "Software",
            status: "SUBMITTED"
        }
    });
    requestId = request.id;
});

after(async () => {
    const userIds = [itUser?.id, adminUser?.id, headItUser?.id, requesterUser?.id].filter(Boolean);
    if (requestId) {
        await prisma.inAppNotification.deleteMany({ where: { referenceId: requestId } });
        await prisma.emailNotification.deleteMany({ where: { referenceId: requestId } });
        await prisma.auditLog.deleteMany({ where: { entityId: requestId } });
        await prisma.itemRequest.deleteMany({ where: { id: requestId } });
    }
    if (userIds.length > 0) {
        await prisma.inAppNotification.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.emailNotification.deleteMany({ where: { recipientUserId: { in: userIds } } });
        await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
    await app.close();
});

test("IT Review API Endpoints", async (t) => {

    await t.test("POST /api/v1/requests/:id/it-review", async () => {
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/it-review`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                itReview: "Reviewed via API"
            }
        });

        assert.equal(response.statusCode, 200, "Should succeed");
        const body = JSON.parse(response.body);
        assert.equal(body.data.status, "IT_REVIEWED");
    });

    await t.test("POST /api/v1/requests/:id/already-purchased", async () => {
        // Reset status
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "SUBMITTED" } });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/already-purchased`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                reason: "Already have it"
            }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.status, "ALREADY_PURCHASED");
    });

    await t.test("Validation: Missing reason for already-purchased", async () => {
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "SUBMITTED" } });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/already-purchased`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {}
        });

        assert.equal(response.statusCode, 400);
    });

    await t.test("POST /api/v1/requests/:id/reject", async () => {
        // Reset status
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "SUBMITTED" } });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/reject`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                rejectionReason: "Denied"
            }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.status, "REJECTED");
    });

    await t.test("Access Control: Requester cannot review", async () => {
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "SUBMITTED" } });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/it-review`,
            headers: { cookie: `it-hub-session=${requesterToken}` },
            payload: { itReview: "Hacking" }
        });

        assert.equal(response.statusCode, 403);
    });

    await t.test("Access Control: Unauthenticated users are rejected", async () => {
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "SUBMITTED" } });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/it-review`,
            payload: { itReview: "Should fail" }
        });

        assert.equal(response.statusCode, 401);
    });

    await t.test("Access Control: Admin can review requests", async () => {
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "SUBMITTED" } });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/it-review`,
            headers: { cookie: `it-hub-session=${adminToken}` },
            payload: { itReview: "Admin review" }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.status, "IT_REVIEWED");
    });

    await t.test("Access Control: Head IT can mark already purchased", async () => {
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "SUBMITTED" } });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/already-purchased`,
            headers: { cookie: `it-hub-session=${headItToken}` },
            payload: { reason: "Stocked by IT" }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.status, "ALREADY_PURCHASED");
    });

    await t.test("Validation: Missing reason for rejection", async () => {
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/reject`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {} // Missing rejectionReason
        });

        assert.equal(response.statusCode, 400);
    });

    await t.test("Status Transition: Reject is only allowed from SUBMITTED", async () => {
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "IT_REVIEWED" } });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/reject`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: { rejectionReason: "Late rejection" }
        });

        assert.equal(response.statusCode, 400);
    });
});
