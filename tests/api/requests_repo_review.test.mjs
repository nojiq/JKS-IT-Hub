/* eslint-disable */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as repo from "../../apps/api/src/features/requests/repo.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

test("Requests Review - Repository Layer", async (t) => {
    let requesterId;
    let reviewerId;
    let requestId;

    // Setup
    await t.test("Setup", async () => {
        // Create requester
        const requester = await prisma.user.create({
            data: {
                username: `requester-test-${randomUUID()}`,
                role: "requester",
                status: "active"
            }
        });
        requesterId = requester.id;

        // Create reviewer (IT staff)
        const reviewer = await prisma.user.create({
            data: {
                username: `reviewer-test-${randomUUID()}`,
                role: "it",
                status: "active"
            }
        });
        reviewerId = reviewer.id;

        // Create request
        const request = await repo.createRequest({
            requesterId,
            itemName: "Review Test Item",
            description: "Test Description",
            justification: "Test Justification",
            priority: "MEDIUM",
            category: "Other",
            status: "SUBMITTED"
        });
        requestId = request.id;
    });

    await t.test("updateRequestITReview", async () => {
        const reviewData = {
            status: "IT_REVIEWED",
            itReview: "Reviewed and approved",
            itReviewedById: reviewerId,
            itReviewedAt: new Date()
        };

        const updatedRequest = await repo.updateRequestITReview(requestId, reviewData);

        assert.equal(updatedRequest.status, "IT_REVIEWED");
        assert.equal(updatedRequest.itReview, reviewData.itReview);
        assert.equal(updatedRequest.itReviewedById, reviewerId);
        assert.ok(updatedRequest.itReviewedAt);
        assert.ok(updatedRequest.itReviewedBy); // Should include relation
    });

    await t.test("updateRequestStatus (Generic)", async () => {
        const current = await repo.getRequestById(requestId);
        const statusData = {
            status: "ALREADY_PURCHASED",
            itReview: "Item already in stock",
            itReviewedById: reviewerId,
            itReviewedAt: new Date(),
            expectedUpdatedAt: current.updatedAt
        };

        const updatedRequest = await repo.updateRequestStatus(requestId, statusData);

        assert.equal(updatedRequest.status, "ALREADY_PURCHASED");
        assert.equal(updatedRequest.itReview, statusData.itReview);
    });

    await t.test("updateRequestStatus (Optimistic locking conflict)", async () => {
        const staleTimestamp = new Date("2000-01-01T00:00:00.000Z");
        await assert.rejects(
            async () => repo.updateRequestStatus(requestId, {
                status: "REJECTED",
                rejectionReason: "Outdated update",
                expectedUpdatedAt: staleTimestamp
            }),
            { name: "Conflict" }
        );
    });

    // Cleanup
    await t.test("Cleanup", async () => {
        if (requestId) {
            await prisma.itemRequest.delete({ where: { id: requestId } });
        }
        if (requesterId) {
            await prisma.user.delete({ where: { id: requesterId } });
        }
        if (reviewerId) {
            await prisma.user.delete({ where: { id: reviewerId } });
        }
        await prisma.$disconnect();
    });
});
