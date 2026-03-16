/* eslint-disable */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");

import appPlugin from "../../apps/api/src/server.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";
import { getAuthConfig } from "../../apps/api/src/config/authConfig.js";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";
import { updateWindowStatuses } from "../../apps/api/src/features/maintenance/scheduler.js";

async function buildApp() {
    const app = Fastify();
    await app.register(appPlugin);
    return app;
}

let app;
let itUser;
let requesterUser;
let itToken;
let requesterToken;
const createdCycleIds = [];
const createdWindowIds = [];

const authHeader = (token) => ({ cookie: `it-hub-session=${token}` });
const assertCycleContract = (cycle) => {
    assert.equal(typeof cycle.id, "string");
    assert.equal(typeof cycle.name, "string");
    assert.equal(typeof cycle.intervalMonths, "number");
    assert.equal(typeof cycle.isActive, "boolean");
    assert.ok(Object.hasOwn(cycle, "description"));
    assert.ok(Object.hasOwn(cycle, "defaultChecklistTemplateId"));
    assert.ok(Object.hasOwn(cycle, "defaultChecklist"));
    assert.ok(Object.hasOwn(cycle, "createdAt"));
    assert.ok(Object.hasOwn(cycle, "updatedAt"));

    if (cycle.defaultChecklist) {
        assert.equal(typeof cycle.defaultChecklist.id, "string");
        assert.equal(typeof cycle.defaultChecklist.name, "string");
        assert.equal(typeof cycle.defaultChecklist.itemCount, "number");
    }
};

before(async () => {
    const authConfig = getAuthConfig();
    app = await buildApp();

    itUser = await prisma.user.create({
        data: {
            username: `it-maint-cycles-${randomUUID()}`,
            role: "it",
            status: "active"
        }
    });
    requesterUser = await prisma.user.create({
        data: {
            username: `req-maint-cycles-${randomUUID()}`,
            role: "requester",
            status: "active"
        }
    });

    itToken = await signSessionToken({
        subject: itUser.id,
        payload: { username: itUser.username, role: itUser.role }
    }, authConfig.jwt);

    requesterToken = await signSessionToken({
        subject: requesterUser.id,
        payload: { username: requesterUser.username, role: requesterUser.role }
    }, authConfig.jwt);
});

after(async () => {
    if (createdWindowIds.length > 0) {
        await prisma.maintenanceWindow.deleteMany({
            where: { id: { in: createdWindowIds } }
        }).catch(() => { });
    }

    if (createdCycleIds.length > 0) {
        await prisma.maintenanceCycleConfig.deleteMany({
            where: { id: { in: createdCycleIds } }
        }).catch(() => { });
    }

    await prisma.auditLog.deleteMany({
        where: {
            OR: [
                { actorUserId: itUser?.id ?? "" },
                { actorUserId: requesterUser?.id ?? "" }
            ]
        }
    }).catch(() => { });

    await prisma.user.deleteMany({
        where: { id: { in: [itUser?.id, requesterUser?.id].filter(Boolean) } }
    }).catch(() => { });

    await app.close();
    await prisma.$disconnect();
});

test("Maintenance cycle API - CRUD, scheduling, windows, RBAC, audit, validation", async (t) => {
    let quarterlyCycleId;
    let biannualCycleId;
    let adHocWindowId;

    await t.test("creates cycle with valid data", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/cycles",
            headers: authHeader(itToken),
            payload: {
                name: `Quarterly Cycle ${randomUUID()}`,
                description: "Quarterly preventive maintenance",
                intervalMonths: 3
            }
        });

        assert.equal(response.statusCode, 201, response.body);
        const body = JSON.parse(response.body);
        quarterlyCycleId = body.data.id;
        createdCycleIds.push(quarterlyCycleId);
        assert.equal(body.data.intervalMonths, 3);
        assert.equal(body.data.isActive, true);
        assertCycleContract(body.data);
    });

    await t.test("rejects invalid cycle payload with RFC 9457 format", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/cycles",
            headers: authHeader(itToken),
            payload: {
                name: "",
                intervalMonths: 0
            }
        });

        assert.equal(response.statusCode, 400, response.body);
        const body = JSON.parse(response.body);
        assert.equal(body.type, "/problems/validation-error");
        assert.equal(body.status, 400);
        assert.equal(typeof body.detail, "string");
    });

    await t.test("enforces RBAC for cycle creation", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/cycles",
            headers: authHeader(requesterToken),
            payload: {
                name: "Unauthorized cycle",
                intervalMonths: 3
            }
        });
        assert.equal(response.statusCode, 403, response.body);
        const body = JSON.parse(response.body);
        assert.equal(body.status, 403);
        assert.equal(typeof body.detail, "string");
        assert.equal(typeof body.type, "string");
    });

    await t.test("updates and deactivates cycle", async () => {
        const updateResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/maintenance/cycles/${quarterlyCycleId}`,
            headers: authHeader(itToken),
            payload: { description: "Updated quarterly cycle description" }
        });
        assert.equal(updateResponse.statusCode, 200, updateResponse.body);
        const updatedCycle = JSON.parse(updateResponse.body).data;
        assert.equal(updatedCycle.description, "Updated quarterly cycle description");
        assertCycleContract(updatedCycle);

        const deactivateResponse = await app.inject({
            method: "DELETE",
            url: `/api/v1/maintenance/cycles/${quarterlyCycleId}`,
            headers: authHeader(itToken)
        });
        assert.equal(deactivateResponse.statusCode, 200, deactivateResponse.body);
        const deactivatedCycle = JSON.parse(deactivateResponse.body).data;
        assert.equal(deactivatedCycle.isActive, false);
        assertCycleContract(deactivatedCycle);
    });

    await t.test("lists active cycles only by default", async () => {
        const activeResponse = await app.inject({
            method: "GET",
            url: "/api/v1/maintenance/cycles",
            headers: authHeader(itToken)
        });
        assert.equal(activeResponse.statusCode, 200, activeResponse.body);
        const activePayload = JSON.parse(activeResponse.body);
        const activeCycles = activePayload.data;
        assert.equal(activePayload.meta.contract, "maintenance-cycle-config.v1");
        assert.ok(Array.isArray(activePayload.meta.requiredFields));
        assert.equal(activeCycles.some((c) => c.id === quarterlyCycleId), false);
        activeCycles.forEach(assertCycleContract);

        const allResponse = await app.inject({
            method: "GET",
            url: "/api/v1/maintenance/cycles?includeInactive=true",
            headers: authHeader(itToken)
        });
        assert.equal(allResponse.statusCode, 200, allResponse.body);
        const allCycles = JSON.parse(allResponse.body).data;
        assert.equal(allCycles.some((c) => c.id === quarterlyCycleId), true);
        allCycles.forEach(assertCycleContract);
    });

    await t.test("returns structured not-found problem when cycle id does not exist", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/v1/maintenance/cycles/${randomUUID()}`,
            headers: authHeader(itToken)
        });

        assert.equal(response.statusCode, 404, response.body);
        const body = JSON.parse(response.body);
        assert.equal(body.status, 404);
        assert.equal(typeof body.detail, "string");
        assert.equal(body.type, "/problems/maintenance/cycle-not-found");
    });

    await t.test("creates quarterly and biannual cycles for schedule generation tests", async () => {
        const quarterlyResponse = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/cycles",
            headers: authHeader(itToken),
            payload: {
                name: `Quarterly Generate ${randomUUID()}`,
                intervalMonths: 3
            }
        });
        assert.equal(quarterlyResponse.statusCode, 201, quarterlyResponse.body);
        quarterlyCycleId = JSON.parse(quarterlyResponse.body).data.id;
        createdCycleIds.push(quarterlyCycleId);

        const biannualResponse = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/cycles",
            headers: authHeader(itToken),
            payload: {
                name: `Biannual Generate ${randomUUID()}`,
                intervalMonths: 6
            }
        });
        assert.equal(biannualResponse.statusCode, 201, biannualResponse.body);
        biannualCycleId = JSON.parse(biannualResponse.body).data.id;
        createdCycleIds.push(biannualCycleId);
    });

    await t.test("generates 12 months schedule for quarterly and biannual cycles", async () => {
        const quarterlyGenerate = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/cycles/${quarterlyCycleId}/generate-schedule`,
            headers: authHeader(itToken),
            payload: { monthsAhead: 12 }
        });
        assert.equal(quarterlyGenerate.statusCode, 200, quarterlyGenerate.body);
        const quarterlyBody = JSON.parse(quarterlyGenerate.body).data;
        assert.equal(quarterlyBody.generated, 4, quarterlyGenerate.body);
        quarterlyBody.windows.forEach((w) => createdWindowIds.push(w.id));

        const biannualGenerate = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/cycles/${biannualCycleId}/generate-schedule`,
            headers: authHeader(itToken),
            payload: { monthsAhead: 12 }
        });
        assert.equal(biannualGenerate.statusCode, 200, biannualGenerate.body);
        const biannualBody = JSON.parse(biannualGenerate.body).data;
        assert.equal(biannualBody.generated, 2, biannualGenerate.body);
        biannualBody.windows.forEach((w) => createdWindowIds.push(w.id));
    });

    await t.test("rejects schedule generation below 12 months horizon", async () => {
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/cycles/${quarterlyCycleId}/generate-schedule`,
            headers: authHeader(itToken),
            payload: { monthsAhead: 6 }
        });

        assert.equal(response.statusCode, 400, response.body);
        const body = JSON.parse(response.body);
        assert.equal(body.type, "/problems/validation-error");
        assert.ok(String(body.detail).includes("monthsAhead"), body.detail);
    });

    await t.test("prevents duplicate windows on subsequent generation", async () => {
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/cycles/${quarterlyCycleId}/generate-schedule`,
            headers: authHeader(itToken),
            payload: { monthsAhead: 12 }
        });
        assert.equal(response.statusCode, 200, response.body);
        const body = JSON.parse(response.body).data;
        assert.equal(body.generated, 0, response.body);
    });

    await t.test("creates, updates, lists, and cancels ad-hoc window", async () => {
        const createdWindow = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/windows",
            headers: authHeader(itToken),
            payload: {
                cycleConfigId: quarterlyCycleId,
                scheduledStartDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
                scheduledEndDate: new Date(Date.now() + 36 * 24 * 60 * 60 * 1000).toISOString(),
                deviceTypes: ["LAPTOP"]
            }
        });
        assert.equal(createdWindow.statusCode, 201, createdWindow.body);
        adHocWindowId = JSON.parse(createdWindow.body).data.id;
        createdWindowIds.push(adHocWindowId);

        const updateWindow = await app.inject({
            method: "PATCH",
            url: `/api/v1/maintenance/windows/${adHocWindowId}`,
            headers: authHeader(itToken),
            payload: {
                scheduledStartDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
                scheduledEndDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
                deviceTypes: ["LAPTOP", "SERVER"]
            }
        });
        assert.equal(updateWindow.statusCode, 200, updateWindow.body);
        assert.equal(JSON.parse(updateWindow.body).data.deviceTypes.length, 2);

        const clearEndDate = await app.inject({
            method: "PATCH",
            url: `/api/v1/maintenance/windows/${adHocWindowId}`,
            headers: authHeader(itToken),
            payload: {
                scheduledEndDate: null
            }
        });
        assert.equal(clearEndDate.statusCode, 200, clearEndDate.body);
        assert.equal(JSON.parse(clearEndDate.body).data.scheduledEndDate, null);

        const listWindows = await app.inject({
            method: "GET",
            url: `/api/v1/maintenance/windows?cycleId=${quarterlyCycleId}`,
            headers: authHeader(itToken)
        });
        assert.equal(listWindows.statusCode, 200, listWindows.body);
        const listedWindows = JSON.parse(listWindows.body).data;
        assert.equal(listedWindows.some((w) => w.id === adHocWindowId), true);

        const cancelWindow = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/windows/${adHocWindowId}/cancel`,
            headers: authHeader(itToken),
            payload: { reason: "Cancelled for test" }
        });
        assert.equal(cancelWindow.statusCode, 200, cancelWindow.body);
        assert.equal(JSON.parse(cancelWindow.body).data.status, "CANCELLED");
    });

    await t.test("rejects duplicate device types on window creation", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/windows",
            headers: authHeader(itToken),
            payload: {
                cycleConfigId: quarterlyCycleId,
                scheduledStartDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
                deviceTypes: ["LAPTOP", "LAPTOP"]
            }
        });

        assert.equal(response.statusCode, 400, response.body);
        const body = JSON.parse(response.body);
        assert.equal(body.type, "/problems/validation-error");
        assert.ok(String(body.detail).includes("Device types must be unique"), body.detail);
    });

    await t.test("updates statuses with SCHEDULED->UPCOMING and UPCOMING/SCHEDULED->OVERDUE transitions", async () => {
        const pastWindowResponse = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/windows",
            headers: authHeader(itToken),
            payload: {
                cycleConfigId: quarterlyCycleId,
                scheduledStartDate: new Date(Date.now() - 36 * 24 * 60 * 60 * 1000).toISOString(),
                deviceTypes: ["SERVER"]
            }
        });
        assert.equal(pastWindowResponse.statusCode, 201, pastWindowResponse.body);
        const pastWindowId = JSON.parse(pastWindowResponse.body).data.id;
        createdWindowIds.push(pastWindowId);

        const nearFutureWindowResponse = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/windows",
            headers: authHeader(itToken),
            payload: {
                cycleConfigId: quarterlyCycleId,
                scheduledStartDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
                deviceTypes: ["DESKTOP_PC"]
            }
        });
        assert.equal(nearFutureWindowResponse.statusCode, 201, nearFutureWindowResponse.body);
        const nearFutureWindowId = JSON.parse(nearFutureWindowResponse.body).data.id;
        createdWindowIds.push(nearFutureWindowId);

        await updateWindowStatuses({ sendNotifications: false });

        const overdue = await app.inject({
            method: "GET",
            url: `/api/v1/maintenance/windows/${pastWindowId}`,
            headers: authHeader(itToken)
        });
        assert.equal(overdue.statusCode, 200, overdue.body);
        assert.equal(JSON.parse(overdue.body).data.status, "OVERDUE");

        const upcoming = await app.inject({
            method: "GET",
            url: `/api/v1/maintenance/windows/${nearFutureWindowId}`,
            headers: authHeader(itToken)
        });
        assert.equal(upcoming.statusCode, 200, upcoming.body);
        assert.equal(JSON.parse(upcoming.body).data.status, "UPCOMING");
    });

    await t.test("writes audit logs for sensitive operations", async () => {
        const logs = await prisma.auditLog.findMany({
            where: {
                actorUserId: itUser.id,
                action: {
                    in: [
                        "MAINTENANCE_CYCLE:CREATE",
                        "MAINTENANCE_CYCLE:UPDATE",
                        "MAINTENANCE_CYCLE:DEACTIVATE",
                        "MAINTENANCE_SCHEDULE:GENERATE",
                        "MAINTENANCE_WINDOW:CREATE",
                        "MAINTENANCE_WINDOW:UPDATE",
                        "MAINTENANCE_WINDOW:CANCEL"
                    ]
                }
            }
        });
        const actions = new Set(logs.map((log) => log.action));
        assert.equal(actions.has("MAINTENANCE_CYCLE:CREATE"), true);
        assert.equal(actions.has("MAINTENANCE_CYCLE:UPDATE"), true);
        assert.equal(actions.has("MAINTENANCE_CYCLE:DEACTIVATE"), true);
        assert.equal(actions.has("MAINTENANCE_SCHEDULE:GENERATE"), true);
        assert.equal(actions.has("MAINTENANCE_WINDOW:CREATE"), true);
        assert.equal(actions.has("MAINTENANCE_WINDOW:UPDATE"), true);
        assert.equal(actions.has("MAINTENANCE_WINDOW:CANCEL"), true);
    });
});
