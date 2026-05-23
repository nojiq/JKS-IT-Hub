/* eslint-disable */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as service from "../../apps/api/src/features/requests/service.js";
import * as repo from "../../apps/api/src/features/requests/repo.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";
import { createLegacyItemRequest } from "./helpers/legacyItemRequest.mjs";

const itemRequest = createLegacyItemRequest(prisma);

test("Requests Approval - Service Layer", async (t) => {
    let requesterUser;
    let adminUser;
    let itUser;
    let devUser;
    let otherUser;
    let requestId;

    // Setup
    await t.test("Setup", async () => {
        // Create users
        requesterUser = await prisma.user.create({
            data: { username: `req-app-${randomUUID()}`, role: "user", status: "active" }
        });
        adminUser = await prisma.user.create({
            data: { username: `admin-app-${randomUUID()}`, role: "admin", status: "active" }
        });
        itUser = await prisma.user.create({
            data: { username: `it-app-${randomUUID()}`, role: "it", status: "active" }
        });
        devUser = await prisma.user.create({
            data: { username: `dev-app-${randomUUID()}`, role: "dev", status: "active" }
        });
        otherUser = await prisma.user.create({
            data: { username: `other-app-${randomUUID()}`, role: "user", status: "active" }
        });

        // Create request in IT_REVIEWED
        const request = await repo.createRequest({
            requesterId: requesterUser.id,
            itemName: "Service Approval Item",
            description: "Desc",
            justification: "Just",
            priority: "MEDIUM",
            category: "Other",
            status: "IT_REVIEWED"
        });
        requestId = request.id;
    });

    await t.test("approveRequest - Validation", async () => {
        // 1. Fail if user is not an IT-related role.
        await assert.rejects(
            async () => service.approveRequest(requestId, otherUser),
            { name: "Forbidden" }
        );

        // 2. Fail if request not found
        await assert.rejects(
            async () => service.approveRequest("fake-id", adminUser),
            { name: "NotFound" }
        );

        // 3. Fail if status invalid (Reset to SUBMITTED) — developer still blocked by status gate after RBAC
        await itemRequest.update({ where: { id: requestId }, data: { status: "SUBMITTED" } });
        await assert.rejects(
            async () => service.approveRequest(requestId, devUser),
            { name: "ValidationError" }
        );

        // Reset to IT_REVIEWED
        await itemRequest.update({ where: { id: requestId }, data: { status: "IT_REVIEWED" } });
    });

    await t.test("approveRequest - Success", async () => {
        const result = await service.approveRequest(requestId, devUser);
        assert.equal(result.status, "APPROVED");
        assert.equal(result.approvedById, devUser.id);
        assert.ok(result.approvedAt);

        // Verify audit log exists
        const log = await prisma.auditLog.findFirst({
            where: { entityId: requestId, action: "request_approved" }
        });
        assert.ok(log, "Audit log should be created");
        assert.equal(log.actorUserId, devUser.id);
    });

    // Cleanup
    await t.test("Cleanup", async () => {
        const userIds = [requesterUser, adminUser, itUser, devUser, otherUser].map((user) => user?.id).filter(Boolean);
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
    });
});
