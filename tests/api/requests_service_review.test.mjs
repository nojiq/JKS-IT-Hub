/* eslint-disable */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as service from "../../apps/api/src/features/requests/service.js";
import * as repo from "../../apps/api/src/features/requests/repo.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

test("Requests Review - Service Layer", async (t) => {
    let requesterUser;
    let itUser;
    let otherUser;
    let requestId;

    // Setup
    await t.test("Setup", async () => {
        // Create users
        requesterUser = await prisma.user.create({
            data: { username: `req-${randomUUID()}`, role: "requester", status: "active" }
        });
        itUser = await prisma.user.create({
            data: { username: `it-${randomUUID()}`, role: "it", status: "active" }
        });
        otherUser = await prisma.user.create({
            data: { username: `other-${randomUUID()}`, role: "requester", status: "active" }
        });

        // Create request
        const request = await repo.createRequest({
            requesterId: requesterUser.id,
            itemName: "Service Test Item",
            description: "Desc",
            justification: "Just",
            priority: "LOW",
            category: "Other",
            status: "SUBMITTED"
        });
        requestId = request.id;
    });

    await t.test("itReviewRequest - Validation", async () => {
        // 1. Fail if user is not IT
        await assert.rejects(
            async () => service.itReviewRequest(requestId, { itReview: "ok" }, requesterUser),
            { name: "Forbidden" }
        );

        // 2. Fail if request not found (fake ID)
        await assert.rejects(
            async () => service.itReviewRequest("fake-id", { itReview: "ok" }, itUser),
            { name: "NotFound" }
        );
    });

    await t.test("itReviewRequest - Success", async () => {
        const result = await service.itReviewRequest(requestId, { itReview: "Approved by IT" }, itUser);
        assert.equal(result.status, "IT_REVIEWED");
        assert.equal(result.itReview, "Approved by IT");
        assert.equal(result.itReviewedById, itUser.id);

        // Verify audit log exists
        const log = await prisma.auditLog.findFirst({
            where: { entityId: requestId, action: "request_it_reviewed" }
        });
        assert.ok(log, "Audit log should be created");
    });

    await t.test("markAlreadyPurchased - Success", async () => {
        // Reset request to SUBMITTED
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "SUBMITTED" } });

        const result = await service.markAlreadyPurchased(requestId, "Already in stock", itUser);
        assert.equal(result.status, "ALREADY_PURCHASED");
        assert.equal(result.itReview, "Already in stock"); // reason stored in itReview

        // Verify audit log
        const log = await prisma.auditLog.findFirst({
            where: { entityId: requestId, action: "request_marked_already_purchased" }
        });
        assert.ok(log);
    });

    await t.test("rejectRequest - Success", async () => {
        // Reset request to SUBMITTED
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "SUBMITTED" } });

        const result = await service.rejectRequest(requestId, "Budget cut", itUser);
        assert.equal(result.status, "REJECTED");
        assert.equal(result.rejectionReason, "Budget cut");

        // Verify audit log
        const log = await prisma.auditLog.findFirst({
            where: { entityId: requestId, action: "request_rejected" }
        });
        assert.ok(log);
    });

    await t.test("markAlreadyPurchased - blocks self-review", async () => {
        const selfRequest = await repo.createRequest({
            requesterId: itUser.id,
            itemName: "IT Self Request Purchase",
            justification: "Self check",
            priority: "LOW",
            status: "SUBMITTED"
        });

        await assert.rejects(
            async () => service.markAlreadyPurchased(selfRequest.id, "Already have it", itUser),
            { name: "Forbidden" }
        );

        await prisma.auditLog.deleteMany({ where: { entityId: selfRequest.id } });
        await prisma.itemRequest.delete({ where: { id: selfRequest.id } });
    });

    await t.test("rejectRequest - blocks self-review", async () => {
        const selfRequest = await repo.createRequest({
            requesterId: itUser.id,
            itemName: "IT Self Request Reject",
            justification: "Self check",
            priority: "LOW",
            status: "SUBMITTED"
        });

        await assert.rejects(
            async () => service.rejectRequest(selfRequest.id, "Rejecting own request", itUser),
            { name: "Forbidden" }
        );

        await prisma.auditLog.deleteMany({ where: { entityId: selfRequest.id } });
        await prisma.itemRequest.delete({ where: { id: selfRequest.id } });
    });

    await t.test("rejectRequest - only allowed from SUBMITTED", async () => {
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "IT_REVIEWED" } });
        await assert.rejects(
            async () => service.rejectRequest(requestId, "Should fail", itUser),
            { name: "ValidationError" }
        );
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "SUBMITTED" } });
    });

    await t.test("Status Transition Validation", async () => {
        // Request is REJECTED now. Trying to review again should fail.
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "REJECTED" } });
        await assert.rejects(
            async () => service.itReviewRequest(requestId, { itReview: "Again" }, itUser),
            { name: "ValidationError" }
        );
    });

    // Cleanup
    await t.test("Cleanup", async () => {
        try {
            const userIds = [requesterUser?.id, itUser?.id, otherUser?.id].filter(Boolean);
            const requests = await prisma.itemRequest.findMany({
                where: { requesterId: { in: userIds } },
                select: { id: true }
            });
            const requestIds = requests.map((request) => request.id);

            if (requestIds.length > 0) {
                await prisma.inAppNotification.deleteMany({ where: { referenceId: { in: requestIds } } });
                await prisma.emailNotification.deleteMany({ where: { referenceId: { in: requestIds } } });
                await prisma.auditLog.deleteMany({ where: { entityId: { in: requestIds } } });
                await prisma.itemRequest.deleteMany({ where: { id: { in: requestIds } } });
            }

            if (userIds.length > 0) {
                await prisma.inAppNotification.deleteMany({ where: { userId: { in: userIds } } });
                await prisma.emailNotification.deleteMany({ where: { recipientUserId: { in: userIds } } });
                await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
                await prisma.user.deleteMany({ where: { id: { in: userIds } } });
            }
            await prisma.$disconnect();
        } catch (error) {
            // Best-effort cleanup: do not fail functional assertions due teardown noise.
            console.warn("Cleanup warning in requests_service_review test:", error.message);
        }
    });
});
