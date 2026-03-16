import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as service from "../../apps/api/src/features/requests/service.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

test("Requests Workflow Enforcement", async (t) => {
    let requesterAdminUser;
    let requesterItUser;
    let otherAdminUser;
    let otherItUser;
    let requestIdSubmitted;
    let requestIdItReviewed;

    // Setup
    await t.test("Setup", async () => {
        try {
            console.log("Starting Setup...");

            // Create users
            // requesterAdminUser = requester who has admin role (for self-approval test)
            // requesterUser = regular requester (for self-review test)  
            // otherAdminUser = different admin (for valid operations)
            // otherItUser = different IT user (for valid operations)
            requesterAdminUser = await prisma.user.create({
                data: { username: `req-admin-${randomUUID()}`, role: "admin", status: "active" }
            });
            otherAdminUser = await prisma.user.create({
                data: { username: `other-admin-${randomUUID()}`, role: "head_it", status: "active" }
            });
            otherItUser = await prisma.user.create({
                data: { username: `other-it-${randomUUID()}`, role: "it", status: "active" }
            });

            // Create request by Admin (to test self-approval)
            const req1 = await prisma.itemRequest.create({
                data: {
                    requesterId: requesterAdminUser.id,
                    itemName: "Self Approval Test",
                    description: "Test",
                    justification: "Test",
                    priority: "MEDIUM",
                    category: "Hardware", // Use a valid category if enum exists, or string
                    status: "IT_REVIEWED"
                }
            });
            requestIdItReviewed = req1.id;

            // Create request by requester for status test
            const requesterUser = await prisma.user.create({
                data: { username: `reg-user-${randomUUID()}`, role: "requester", status: "active" }
            });
            const req2 = await prisma.itemRequest.create({
                data: {
                    requesterId: requesterUser.id,
                    itemName: "Status Test Request",
                    description: "Test",
                    justification: "Test",
                    priority: "MEDIUM",
                    category: "Hardware",
                    status: "SUBMITTED"
                }
            });
            requestIdSubmitted = req2.id;
            requesterItUser = requesterUser; // Store for cleanup
            console.log("Setup Complete. IDs:", requestIdItReviewed, requestIdSubmitted);
        } catch (error) {
            console.error("Setup Failed:", error);
            throw error;
        }
    });

    // Test 1: Self-Approval Prevention
    await t.test("approveRequest - Should block self-approval", async () => {
        // requesterAdminUser tries to approve their own request
        await assert.rejects(
            async () => service.approveRequest(requestIdItReviewed, requesterAdminUser),
            (err) => {
                assert.match(err.message, /Cannot approve your own request/);
                assert.equal(err.name, "Forbidden");
                return true;
            },
            "Should reject self-approval"
        );

        // Verify audit log
        const log = await prisma.auditLog.findFirst({
            where: {
                entityId: requestIdItReviewed,
                action: "workflow_violation_blocked",
                metadata: {
                    path: "$.reason",
                    equals: "self_approval_blocked"
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        assert.ok(log, "Audit log should exist for blocked self-approval");
    });

    // Test 2: Self-Review Prevention
    await t.test("itReviewRequest - Should block self-review", async () => {
        // otherItUser (IT role) tries to review a request they themselves made
        // First, create a request BY the IT user
        const selfRequest = await prisma.itemRequest.create({
            data: {
                requesterId: otherItUser.id, // IT user is the requester
                itemName: "IT Self Request",
                description: "Test",
                justification: "Test",
                priority: "MEDIUM",
                category: "Hardware",
                status: "SUBMITTED"
            }
        });

        // Now IT user tries to review their own request
        await assert.rejects(
            async () => service.itReviewRequest(selfRequest.id, { itReview: "Looks good" }, otherItUser),
            (err) => {
                assert.match(err.message, /Cannot review your own request/);
                assert.equal(err.name, "Forbidden");
                return true;
            },
            "Should reject self-review"
        );

        // Verify audit log
        const log = await prisma.auditLog.findFirst({
            where: {
                entityId: selfRequest.id,
                action: "workflow_violation_blocked",
                metadata: {
                    path: "$.reason",
                    equals: "self_review_blocked"
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        assert.ok(log, "Audit log should exist for blocked self-review");

        // Cleanup this request
        await prisma.auditLog.deleteMany({ where: { entityId: selfRequest.id } });
        await prisma.itemRequest.delete({ where: { id: selfRequest.id } });
    });

    // Test 3: Status Transition Enforcement
    await t.test("approveRequest - Should block approval from SUBMITTED", async () => {
        // Try to approve a SUBMITTED request (requestIdSubmitted)
        // Even if user is valid admin (otherAdminUser)
        await assert.rejects(
            async () => service.approveRequest(requestIdSubmitted, otherAdminUser),
            (err) => {
                assert.match(err.message, /Cannot approve request in status: SUBMITTED. Request must be IT reviewed first./);
                assert.equal(err.name, "ValidationError");
                return true;
            },
            "Should reject approval from SUBMITTED"
        );

        // Verify audit log for workflow violation
        const log = await prisma.auditLog.findFirst({
            where: {
                entityId: requestIdSubmitted,
                action: "workflow_violation_blocked",
                metadata: {
                    path: "$.reason",
                    equals: "it_review_required"
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        assert.ok(log, "Audit log should exist for status violation");
    });

    // Cleanup
    await t.test("Cleanup", async () => {
        // Build list of all request IDs we created
        const ids = [requestIdItReviewed, requestIdSubmitted].filter(Boolean);

        // Build list of all user IDs
        const userIds = [requesterAdminUser?.id, requesterItUser?.id, otherAdminUser?.id, otherItUser?.id].filter(Boolean);

        // Delete from deepest dependencies to shallowest
        // 1. Delete all audit logs for these users' actions
        if (userIds.length > 0) {
            await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
        }

        // 2. Delete all item requests created by these users (and their audit logs)
        if (userIds.length > 0) {
            // Find all requests by these users
            const allRequests = await prisma.itemRequest.findMany({
                where: { requesterId: { in: userIds } },
                select: { id: true }
            });
            const allRequestIds = allRequests.map(r => r.id);

            if (allRequestIds.length > 0) {
                await prisma.auditLog.deleteMany({ where: { entityId: { in: allRequestIds } } });
                await prisma.itemRequest.deleteMany({ where: { id: { in: allRequestIds } } });
            }
        }

        // 3. Finally delete users
        if (userIds.length > 0) {
            await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }

        await prisma.$disconnect();
    });
});
