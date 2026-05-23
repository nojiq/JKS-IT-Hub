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
import { __setTransporter } from "../../apps/api/src/features/notifications/email/emailService.js";

async function build() {
    const app = Fastify();
    await app.register(appPlugin);
    return app;
}

let app;
let itUser, adminUser, headItUser, devUser, requesterUser;
let itToken, adminToken, headItToken, devToken, requesterToken;
let config;
let requestId;

const legacyStatusData = (status) => {
    if (status === "SUBMITTED") {
        return { recordStatus: "RECORDED", approvalStatus: "NOT_REQUIRED", approvalNote: null };
    }
    if (status === "IT_REVIEWED") {
        return { recordStatus: "RECORDED", approvalStatus: "PENDING" };
    }
    if (status === "REJECTED") {
        return { recordStatus: "REJECTED", approvalStatus: "REJECTED" };
    }
    return {};
};

const setRequestStatus = (status) =>
    prisma.purchaseRecord.update({
        where: { id: requestId },
        data: legacyStatusData(status)
    });

before(async () => {
    config = getAuthConfig();
    process.env.SMTP_HOST = "mock.smtp.test";
    __setTransporter({
        sendMail: async () => ({ messageId: "request-review-api-test" })
    });
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

    devUser = await prisma.user.create({
        data: {
            username: `dev-review-${randomUUID()}`,
            role: "dev",
            status: "active"
        }
    });

    // Create User Role
    requesterUser = await prisma.user.create({
        data: {
            username: `req-review-${randomUUID()}`,
            role: "user",
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

    devToken = await signSessionToken({
        subject: devUser.id,
        payload: { username: devUser.username, role: devUser.role }
    }, config.jwt);

    requesterToken = await signSessionToken({
        subject: requesterUser.id,
        payload: { username: requesterUser.username, role: requesterUser.role }
    }, config.jwt);

    // Create Request
    const request = await prisma.purchaseRecord.create({
        data: {
            requesterId: requesterUser.id,
            reason: "Just",
            recordedById: requesterUser.id,
            recordStatus: "RECORDED",
            approvalStatus: "NOT_REQUIRED",
            items: {
                create: {
                    itemName: "Review API Test",
                    description: "Desc",
                    category: "Software",
                    quantity: 1
                }
            }
        }
    });
    requestId = request.id;
});

after(async () => {
    const userIds = [itUser?.id, adminUser?.id, headItUser?.id, devUser?.id, requesterUser?.id].filter(Boolean);
    if (requestId) {
        await prisma.inAppNotification.deleteMany({ where: { referenceId: requestId } });
        await prisma.emailNotification.deleteMany({ where: { referenceId: requestId } });
        await prisma.auditLog.deleteMany({ where: { entityId: requestId } });
        await prisma.purchaseRecord.deleteMany({ where: { id: requestId } });
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
            headers: { cookie: `it-hub-session=${devToken}` },
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
        await setRequestStatus("SUBMITTED");

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/already-purchased`,
            headers: { cookie: `it-hub-session=${devToken}` },
            payload: {
                reason: "Already have it"
            }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.status, "ALREADY_PURCHASED");
    });

    await t.test("Validation: Missing reason for already-purchased", async () => {
        await setRequestStatus("SUBMITTED");

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/already-purchased`,
            headers: { cookie: `it-hub-session=${devToken}` },
            payload: {}
        });

        assert.equal(response.statusCode, 400);
    });

    await t.test("POST /api/v1/requests/:id/reject", async () => {
        // Reset status
        await setRequestStatus("SUBMITTED");

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/reject`,
            headers: { cookie: `it-hub-session=${devToken}` },
            payload: {
                rejectionReason: "Denied"
            }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.status, "REJECTED");
    });

    await t.test("Access Control: Requester cannot review", async () => {
        await setRequestStatus("SUBMITTED");

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/it-review`,
            headers: { cookie: `it-hub-session=${requesterToken}` },
            payload: { itReview: "Hacking" }
        });

        assert.equal(response.statusCode, 403);
    });

    await t.test("Access Control: Unauthenticated users are rejected", async () => {
        await setRequestStatus("SUBMITTED");

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/it-review`,
            payload: { itReview: "Should fail" }
        });

        assert.equal(response.statusCode, 401);
    });

    await t.test("Access Control: IT user can it-review", async () => {
        await setRequestStatus("SUBMITTED");

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/it-review`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: { itReview: "Should fail" }
        });

        assert.equal(response.statusCode, 200);
    });

    await t.test("Access Control: Admin can it-review requests", async () => {
        await setRequestStatus("SUBMITTED");

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/it-review`,
            headers: { cookie: `it-hub-session=${adminToken}` },
            payload: { itReview: "Admin review" }
        });

        assert.equal(response.statusCode, 200);
    });

    await t.test("Access Control: Head IT can mark already purchased", async () => {
        await setRequestStatus("SUBMITTED");

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/already-purchased`,
            headers: { cookie: `it-hub-session=${headItToken}` },
            payload: { reason: "Stocked by IT" }
        });

        assert.equal(response.statusCode, 200);
    });

    await t.test("Validation: Missing reason for rejection", async () => {
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/reject`,
            headers: { cookie: `it-hub-session=${devToken}` },
            payload: {} // Missing rejectionReason
        });

        assert.equal(response.statusCode, 400);
    });

    await t.test("Status Transition: Reject is only allowed from SUBMITTED", async () => {
        await setRequestStatus("IT_REVIEWED");

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${requestId}/reject`,
            headers: { cookie: `it-hub-session=${devToken}` },
            payload: { rejectionReason: "Late rejection" }
        });

        assert.equal(response.statusCode, 400);
    });
});
