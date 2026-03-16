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
let itUser, techUser1, techUser2, requesterUser;
let itToken, techToken1, techToken2, requesterToken;
let config;

before(async () => {
    config = getAuthConfig();
    app = await build();

    // Create IT User (Admin)
    itUser = await prisma.user.create({
        data: {
            username: `it-admin-${randomUUID()}`,
            role: "it",
            status: "active"
        }
    });

    // Create Technician 1
    techUser1 = await prisma.user.create({
        data: {
            username: `tech-1-${randomUUID()}`,
            role: "it",
            status: "active"
        }
    });

    // Create Technician 2
    techUser2 = await prisma.user.create({
        data: {
            username: `tech-2-${randomUUID()}`,
            role: "it",
            status: "active"
        }
    });

    // Create Requester User
    requesterUser = await prisma.user.create({
        data: {
            username: `requester-${randomUUID()}`,
            role: "requester",
            status: "active"
        }
    });

    // Tokens
    itToken = await signSessionToken({
        subject: itUser.id,
        payload: { username: itUser.username, role: itUser.role }
    }, config.jwt);

    techToken1 = await signSessionToken({
        subject: techUser1.id,
        payload: { username: techUser1.username, role: techUser1.role }
    }, config.jwt);

    requesterToken = await signSessionToken({
        subject: requesterUser.id,
        payload: { username: requesterUser.username, role: requesterUser.role }
    }, config.jwt);
});

after(async () => {
    const userIds = [itUser?.id, techUser1?.id, techUser2?.id, requesterUser?.id].filter(id => !!id);

    // 1. Delete all relevant maintenance windows first
    // This catches windows by cycle name OR user association
    await prisma.maintenanceWindow.deleteMany({
        where: {
            OR: [
                { cycleConfig: { name: { startsWith: 'Auto-Assign Cycle' } } },
                { createdById: { in: userIds } },
                { assignedToId: { in: userIds } }
            ]
        }
    });

    // 2. Delete assignment rules (cascades to technicians and rotation states)
    await prisma.departmentAssignmentRule.deleteMany({
        where: { department: { startsWith: 'Engineering-' } }
    });

    // 3. Delete cycles
    await prisma.maintenanceCycleConfig.deleteMany({
        where: { name: { startsWith: 'Auto-Assign Cycle' } }
    });

    // 4. Clean up users
    await prisma.user.deleteMany({
        where: { id: { in: userIds } }
    });

    await prisma.$disconnect();
    await app.close();
});

test("Department Assignment Rules - CRUD & Logic", async (t) => {
    let ruleId;
    let cycleId;
    const departmentName = `Engineering-${randomUUID().substring(0, 8)}`;

    await t.test("1. IT User can create an assignment rule (FIXED)", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/assignment-rules",
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                department: departmentName,
                assignmentStrategy: "FIXED",
                technicianIds: [techUser1.id, techUser2.id],
                isActive: true
            }
        });

        assert.equal(response.statusCode, 201, "Should return 201 Created");
        const body = JSON.parse(response.body);
        assert.ok(body.data.id, "Should have rule ID");
        assert.equal(body.data.department, departmentName);
        assert.equal(body.data.assignmentStrategy, "FIXED");
        assert.equal(body.data.technicians.length, 2);

        ruleId = body.data.id;
    });

    await t.test("2. IT User can update an assignment rule (Switch to ROTATION)", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/maintenance/assignment-rules/${ruleId}`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                assignmentStrategy: "ROTATION"
            }
        });

        assert.equal(response.statusCode, 200, "Should return 200 OK");
        const body = JSON.parse(response.body);
        assert.equal(body.data.assignmentStrategy, "ROTATION");
    });

    await t.test("3. Auto-Assignment Logic (Rotation)", async () => {
        // Create a maintenance cycle
        const cycleResponse = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/cycles",
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                name: `Auto-Assign Cycle - ${departmentName}`,
                intervalMonths: 1,
                description: "Test cycle for auto-assignment"
            }
        });
        cycleId = JSON.parse(cycleResponse.body).data.id;

        // Generate schedule for this department
        // Note: The generate-schedule endpoint needs to support 'department' param or we need a way to trigger window creation with department
        // Assuming generate-schedule accepts department in payload based on previous implementation
        const scheduleResponse = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/cycles/${cycleId}/generate-schedule`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                monthsAhead: 1,
                department: departmentName
            }
        });

        assert.equal(scheduleResponse.statusCode, 200);
        const scheduleBody = JSON.parse(scheduleResponse.body);
        const window = scheduleBody.data.windows[0];

        assert.ok(window, "Should have generated a window");
        assert.ok(window.assignedToId, "Window should be assigned");
        // First in rotation should be techUser1 (based on orderIndex usually, but let's blindly check it's one of them)
        assert.ok([techUser1.id, techUser2.id].includes(window.assignedToId));
        assert.equal(window.assignmentReason, "rotation");
    });

    await t.test("4. Manual Assignment Override", async () => {
        const rotationBefore = await prisma.departmentRotationState.findUnique({
            where: { ruleId }
        });

        // Create an ad-hoc window first
        const windowResponse = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/windows",
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                cycleConfigId: cycleId,
                deviceTypes: ["LAPTOP"],
                scheduledStartDate: new Date().toISOString(),
                scheduledEndDate: new Date(Date.now() + 3600000).toISOString()
            }
        });

        const windowId = JSON.parse(windowResponse.body).data.id;

        // Manually assign to Tech 2
        const assignResponse = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/windows/${windowId}/assign`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                userId: techUser2.id
            }
        });

        assert.equal(assignResponse.statusCode, 200);
        const body = JSON.parse(assignResponse.body);
        assert.equal(body.data.assignedToId, techUser2.id);
        assert.equal(body.data.assignmentReason, "manual-override");

        // Manual overrides must not advance rotation state
        const rotationAfter = await prisma.departmentRotationState.findUnique({
            where: { ruleId }
        });
        assert.equal(
            rotationAfter.currentTechnicianIndex,
            rotationBefore.currentTechnicianIndex,
            "Manual assignment must not advance rotation index"
        );
    });

    await t.test("5. Missing rule keeps generated windows unassigned and logs warning", async () => {
        const noRuleDepartment = `No-Rule-${randomUUID().substring(0, 8)}`;
        const noRuleCycleResponse = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/cycles",
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                name: `Auto-Assign Cycle - No Rule - ${noRuleDepartment}`,
                intervalMonths: 1,
                description: "Cycle without assignment rule"
            }
        });
        const noRuleCycleId = JSON.parse(noRuleCycleResponse.body).data.id;

        const warnMessages = [];
        const originalWarn = console.warn;
        console.warn = (...args) => {
            warnMessages.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "));
        };

        try {
            const scheduleResponse = await app.inject({
                method: "POST",
                url: `/api/v1/maintenance/cycles/${noRuleCycleId}/generate-schedule`,
                headers: { cookie: `it-hub-session=${itToken}` },
                payload: {
                    monthsAhead: 1,
                    department: noRuleDepartment
                }
            });

            assert.equal(scheduleResponse.statusCode, 200);
            const body = JSON.parse(scheduleResponse.body);
            const generatedWindow = body.data.windows[0];
            assert.ok(generatedWindow, "Should generate a maintenance window");
            assert.equal(generatedWindow.assignedToId, null);
            assert.equal(generatedWindow.assignmentReason, null);
        } finally {
            console.warn = originalWarn;
        }

        assert.ok(
            warnMessages.some((message) => message.includes("No active assignment rule for department") && message.includes(noRuleDepartment)),
            "Expected warning about missing assignment rule"
        );
    });



    await t.test("6. Access Control - Requester cannot manage rules", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/assignment-rules",
            headers: { cookie: `it-hub-session=${requesterToken}` },
            payload: {
                department: "HR",
                assignmentStrategy: "FIXED",
                technicianIds: [techUser1.id]
            }
        });

        assert.equal(response.statusCode, 403);
    });

    await t.test("7. Rotation handles wrap-around", async () => {
        // We have 2 technicians (tech1, tech2)
        // Current index should be 1 (after test 3 advanced it once)

        // Generate more windows
        const scheduleResponse = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/cycles/${cycleId}/generate-schedule`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: { monthsAhead: 12, department: departmentName }
        });

        assert.equal(scheduleResponse.statusCode, 200);
        const scheduleBody = JSON.parse(scheduleResponse.body);
        const windows = scheduleBody.data.windows;

        assert.ok(windows.length >= 2, "Should have generated at least 2 windows");

        // window[0] should be tech2 (index 1)
        // window[1] should be tech1 (index 0 - wrap)
        assert.equal(windows[0].assignedToId, techUser2.id);
        assert.equal(windows[1].assignedToId, techUser1.id, "Should wrap back to first technician");
    });

    await t.test("8. Reset Rotation", async () => {
        // Reset rotation for the rule
        const resetResponse = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/assignment-rules/${ruleId}/reset-rotation`,
            headers: { cookie: `it-hub-session=${itToken}` }
        });

        assert.equal(resetResponse.statusCode, 200);
        const body = JSON.parse(resetResponse.body);
        assert.equal(body.data.currentTechnicianIndex, 0);

        // Verify next assignment is techUser1
        // We generate windows far enough in the future to ensure new ones are created
        const scheduleResponse = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/cycles/${cycleId}/generate-schedule`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: { monthsAhead: 24, department: departmentName }
        });
        const windows = JSON.parse(scheduleResponse.body).data.windows;
        assert.ok(windows.length > 0);
        assert.equal(windows[0].assignedToId, techUser1.id);
    });

    await t.test("9. Validation - Empty Department", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/assignment-rules",
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                department: "",
                assignmentStrategy: "FIXED",
                technicianIds: [techUser1.id]
            }
        });

        assert.equal(response.statusCode, 400);
    });

    await t.test("10. Fetch My Assigned Tasks", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/maintenance/my-tasks",
            headers: { cookie: `it-hub-session=${techToken1}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.ok(Array.isArray(body.data));
        // Should have at least the windows from rotation wrap-around (tech1)
        assert.ok(body.data.length > 0);
        assert.equal(body.data[0].assignedToId, techUser1.id);
    });

    await t.test("11. Deactivate Assignment Rule", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/maintenance/assignment-rules/${ruleId}`,
            headers: { cookie: `it-hub-session=${itToken}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.isActive, false);
    });
    await t.test("12. Validation - No Technicians", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/assignment-rules",
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                department: `Empty-Techs-${randomUUID()}`,
                assignmentStrategy: "FIXED",
                technicianIds: []
            }
        });
        assert.equal(response.statusCode, 400);
    });

    await t.test("13. Validation - Invalid Technician IDs", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/assignment-rules",
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                department: `Invalid-Techs-${randomUUID()}`,
                assignmentStrategy: "FIXED",
                technicianIds: [randomUUID()]
            }
        });
        assert.equal(response.statusCode, 400);
    });

    await t.test("14. Validation - Duplicate Department", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/assignment-rules",
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                department: departmentName,
                assignmentStrategy: "FIXED",
                technicianIds: [techUser1.id]
            }
        });
        assert.equal(response.statusCode, 409);
    });

    await t.test("15. Audit Logging", async () => {
        const logs = await prisma.auditLog.findMany({
            where: {
                entityId: ruleId
            }
        });

        console.log("Audit Logs found:", JSON.stringify(logs, null, 2));

        assert.ok(logs.length >= 2, "Should have audit logs");
        const actions = logs.map(l => l.action);
        assert.ok(actions.some(a => a.includes("CREATE")), "created log");
        assert.ok(actions.some(a => a.includes("UPDATE") || a.includes("DEACTIVATE")), "updated/deactivated log");
    });
});
