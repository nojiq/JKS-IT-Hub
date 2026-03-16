/* eslint-disable */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as service from "../../apps/api/src/features/requests/service.js";
import * as repo from "../../apps/api/src/features/requests/repo.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

test("Requests Approval - Service Layer", async (t) => {
    let requesterUser;
    let adminUser;
    let itUser;
    let otherUser;
    let requestId;

    // Setup
    await t.test("Setup", async () => {
        // Create users
        requesterUser = await prisma.user.create({
            data: { username: `req-app-${randomUUID()}`, role: "requester", status: "active" }
        });
        adminUser = await prisma.user.create({
            data: { username: `admin-app-${randomUUID()}`, role: "admin", status: "active" }
        });
        itUser = await prisma.user.create({
            data: { username: `it-app-${randomUUID()}`, role: "it", status: "active" }
        });
        otherUser = await prisma.user.create({
            data: { username: `other-app-${randomUUID()}`, role: "requester", status: "active" }
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
        // 1. Fail if user is not Admin/Head IT (IT user cannot approve)
        await assert.rejects(
            async () => service.approveRequest(requestId, itUser),
            { name: "Forbidden" }
        );

        // 2. Fail if request not found
        await assert.rejects(
            async () => service.approveRequest("fake-id", adminUser),
            { name: "NotFound" }
        );

        // 3. Fail if status invalid (Reset to SUBMITTED)
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "SUBMITTED" } });
        await assert.rejects(
            async () => service.approveRequest(requestId, adminUser),
            { name: "ValidationError" }
        );

        // Reset to IT_REVIEWED
        await prisma.itemRequest.update({ where: { id: requestId }, data: { status: "IT_REVIEWED" } });
    });

    await t.test("approveRequest - Success", async () => {
        const result = await service.approveRequest(requestId, adminUser);
        assert.equal(result.status, "APPROVED");
        assert.equal(result.approvedById, adminUser.id);
        assert.ok(result.approvedAt);

        // Verify audit log exists
        const log = await prisma.auditLog.findFirst({
            where: { entityId: requestId, action: "request_approved" }
        });
        assert.ok(log, "Audit log should be created");
        assert.equal(log.actorUserId, adminUser.id);
    });

    // Cleanup
    await t.test("Cleanup", async () => {
        if (requestId) await prisma.itemRequest.delete({ where: { id: requestId } });
        if (requesterUser) await prisma.user.delete({ where: { id: requesterUser.id } });
        if (adminUser) await prisma.user.delete({ where: { id: adminUser.id } });
        if (itUser) await prisma.user.delete({ where: { id: itUser.id } });
        if (otherUser) await prisma.user.delete({ where: { id: otherUser.id } });
        await prisma.$disconnect();
    });
});
