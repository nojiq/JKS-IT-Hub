/* eslint-disable */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as repo from "../../apps/api/src/features/requests/repo.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

test("Requests Approval - Repository Layer", async (t) => {
    let requesterId;
    let adminId;
    let requestId;

    // Setup
    await t.test("Setup", async () => {
        // Create requester
        const requester = await prisma.user.create({
            data: {
                username: `requester-approval-${randomUUID()}`,
                role: "requester",
                status: "active"
            }
        });
        requesterId = requester.id;

        // Create admin
        const admin = await prisma.user.create({
            data: {
                username: `admin-approval-${randomUUID()}`,
                role: "admin",
                status: "active"
            }
        });
        adminId = admin.id;

        // Create request in IT_REVIEWED status
        const request = await repo.createRequest({
            requesterId,
            itemName: "Approval Test Item",
            description: "Test Description",
            justification: "Test Justification",
            priority: "MEDIUM",
            category: "Other",
            status: "IT_REVIEWED",
            itReview: "LGTM",
            itReviewedAt: new Date()
        });
        requestId = request.id;
    });

    await t.test("updateRequestStatus should handle approval fields", async () => {
        const approvalData = {
            status: "APPROVED",
            approvedById: adminId,
            approvedAt: new Date()
        };

        const updatedRequest = await repo.updateRequestStatus(requestId, approvalData);

        assert.equal(updatedRequest.status, "APPROVED");
        assert.equal(updatedRequest.approvedById, adminId);
        assert.ok(updatedRequest.approvedAt);
        assert.ok(updatedRequest.approvedBy); // Should include relation
        assert.equal(updatedRequest.approvedBy.username, updatedRequest.approvedBy.username);
    });

    await t.test("approveRequest", async () => {
        // Reset status
        await prisma.itemRequest.update({
            where: { id: requestId },
            data: { status: "IT_REVIEWED", approvedById: null, approvedAt: null }
        });

        const approvedAt = new Date();
        const updatedRequest = await repo.approveRequest(requestId, adminId, approvedAt);

        assert.equal(updatedRequest.status, "APPROVED");
        assert.equal(updatedRequest.approvedById, adminId);
        assert.ok(updatedRequest.approvedAt);
    });

    // Cleanup
    await t.test("Cleanup", async () => {
        if (requestId) {
            await prisma.itemRequest.delete({ where: { id: requestId } });
        }
        if (requesterId) {
            await prisma.user.delete({ where: { id: requesterId } });
        }
        if (adminId) {
            await prisma.user.delete({ where: { id: adminId } });
        }
    });
});
