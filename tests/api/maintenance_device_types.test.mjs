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

const buildApp = async () => {
    const app = Fastify();
    await app.register(appPlugin);
    return app;
};

const authHeader = (token) => ({ cookie: `it-hub-session=${token}` });

let app;
let users;
let tokens;
let cycleId;
let checklistTemplateId;
let checklistItemId;
const createdWindowIds = [];

before(async () => {
    app = await buildApp();
    const authConfig = getAuthConfig();

    users = {
        it: await prisma.user.create({
            data: {
                username: `it-device-types-${randomUUID()}`,
                role: "it",
                status: "active"
            }
        }),
        admin: await prisma.user.create({
            data: {
                username: `admin-device-types-${randomUUID()}`,
                role: "admin",
                status: "active"
            }
        }),
        head: await prisma.user.create({
            data: {
                username: `head-device-types-${randomUUID()}`,
                role: "head_it",
                status: "active"
            }
        }),
        requester: await prisma.user.create({
            data: {
                username: `requester-device-types-${randomUUID()}`,
                role: "requester",
                status: "active"
            }
        })
    };

    tokens = {
        it: await signSessionToken({
            subject: users.it.id,
            payload: { username: users.it.username, role: users.it.role }
        }, authConfig.jwt),
        admin: await signSessionToken({
            subject: users.admin.id,
            payload: { username: users.admin.username, role: users.admin.role }
        }, authConfig.jwt),
        head: await signSessionToken({
            subject: users.head.id,
            payload: { username: users.head.username, role: users.head.role }
        }, authConfig.jwt),
        requester: await signSessionToken({
            subject: users.requester.id,
            payload: { username: users.requester.username, role: users.requester.role }
        }, authConfig.jwt)
    };
});

after(async () => {
    try {
        if (createdWindowIds.length > 0) {
            await prisma.maintenanceCompletion.deleteMany({
                where: { windowId: { in: createdWindowIds } }
            }).catch(() => { });

            await prisma.maintenanceWindow.deleteMany({
                where: { id: { in: createdWindowIds } }
            }).catch(() => { });
        }

        if (checklistTemplateId) {
            await prisma.maintenanceChecklistTemplate.delete({
                where: { id: checklistTemplateId }
            }).catch(() => { });
        }

        if (cycleId) {
            await prisma.maintenanceCycleConfig.delete({
                where: { id: cycleId }
            }).catch(() => { });
        }

        const userIds = Object.values(users || {}).map((u) => u.id);
        if (userIds.length > 0) {
            await prisma.auditLog.deleteMany({
                where: { actorUserId: { in: userIds } }
            }).catch(() => { });

            await prisma.user.deleteMany({
                where: { id: { in: userIds } }
            }).catch(() => { });
        }
    } finally {
        await app?.close().catch(() => { });
        await prisma.$disconnect().catch(() => { });
    }
});

test("Maintenance Device Types - API Integration", async (t) => {
    let windowId;

    await t.test("setup cycle and checklist template", async () => {
        const cycleResponse = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/cycles",
            headers: authHeader(tokens.it),
            payload: {
                name: `Device Type Cycle ${randomUUID()}`,
                intervalMonths: 3
            }
        });
        assert.equal(cycleResponse.statusCode, 201, cycleResponse.body);
        cycleId = JSON.parse(cycleResponse.body).data.id;

        const checklistResponse = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/checklists",
            headers: authHeader(tokens.it),
            payload: {
                name: `Device Type Checklist ${randomUUID()}`,
                items: [
                    {
                        title: "Verify maintenance result",
                        isRequired: true,
                        orderIndex: 0
                    }
                ]
            }
        });
        assert.equal(checklistResponse.statusCode, 201, checklistResponse.body);
        const checklistBody = JSON.parse(checklistResponse.body);
        checklistTemplateId = checklistBody.data.id;
        checklistItemId = checklistBody.data.items[0].id;

        const cycleUpdateResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/maintenance/cycles/${cycleId}`,
            headers: authHeader(tokens.it),
            payload: { defaultChecklistTemplateId: checklistTemplateId }
        });
        assert.equal(cycleUpdateResponse.statusCode, 200, cycleUpdateResponse.body);
    });

    await t.test("create window with device types and retrieve detail", async () => {
        const createResponse = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/windows",
            headers: authHeader(tokens.it),
            payload: {
                cycleConfigId: cycleId,
                scheduledStartDate: new Date().toISOString(),
                deviceTypes: ["LAPTOP", "DESKTOP_PC"]
            }
        });
        assert.equal(createResponse.statusCode, 201, createResponse.body);
        const createBody = JSON.parse(createResponse.body);
        windowId = createBody.data.id;
        createdWindowIds.push(windowId);
        assert.deepEqual(createBody.data.deviceTypes.sort(), ["DESKTOP_PC", "LAPTOP"]);

        const detailResponse = await app.inject({
            method: "GET",
            url: `/api/v1/maintenance/windows/${windowId}`,
            headers: authHeader(tokens.it)
        });
        assert.equal(detailResponse.statusCode, 200, detailResponse.body);
        const detailBody = JSON.parse(detailResponse.body);
        assert.deepEqual(detailBody.data.deviceTypes.sort(), ["DESKTOP_PC", "LAPTOP"]);
    });

    await t.test("update window device types via admin and head_it roles", async () => {
        const adminUpdate = await app.inject({
            method: "PATCH",
            url: `/api/v1/maintenance/windows/${windowId}`,
            headers: authHeader(tokens.admin),
            payload: { deviceTypes: ["SERVER"] }
        });
        assert.equal(adminUpdate.statusCode, 200, adminUpdate.body);
        assert.deepEqual(JSON.parse(adminUpdate.body).data.deviceTypes, ["SERVER"]);

        const headUpdate = await app.inject({
            method: "PATCH",
            url: `/api/v1/maintenance/windows/${windowId}`,
            headers: authHeader(tokens.head),
            payload: { deviceTypes: ["LAPTOP", "SERVER"] }
        });
        assert.equal(headUpdate.statusCode, 200, headUpdate.body);
        assert.deepEqual(JSON.parse(headUpdate.body).data.deviceTypes.sort(), ["LAPTOP", "SERVER"]);
    });

    await t.test("validation rejects missing deviceTypes with RFC 9457", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/windows",
            headers: authHeader(tokens.it),
            payload: {
                cycleConfigId: cycleId,
                scheduledStartDate: new Date().toISOString()
            }
        });
        assert.equal(response.statusCode, 400, response.body);
        const body = JSON.parse(response.body);
        assert.equal(body.type, "/problems/validation-error");
        assert.equal(body.status, 400);
        assert.match(body.detail, /deviceTypes/i);
    });

    await t.test("window list supports deviceType and status filters together", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/maintenance/windows?deviceType=SERVER&status=SCHEDULED",
            headers: authHeader(tokens.it)
        });
        assert.equal(response.statusCode, 200, response.body);
        const body = JSON.parse(response.body);
        const found = body.data.find((window) => window.id === windowId);
        assert.ok(found, "Expected window to be returned by combined status+deviceType filters");
        assert.ok(found.deviceTypes.includes("SERVER"));
    });

    await t.test("completion snapshot captures device types and history filter uses snapshot", async () => {
        const assignResponse = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/windows/${windowId}/assign`,
            headers: authHeader(tokens.admin),
            payload: { userId: users.it.id }
        });
        assert.equal(assignResponse.statusCode, 200, assignResponse.body);

        const signOffResponse = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/windows/${windowId}/sign-off`,
            headers: authHeader(tokens.it),
            payload: {
                notes: "Completed for snapshot verification",
                completedItems: [
                    {
                        checklistItemId,
                        itemTitle: "Verify maintenance result",
                        isRequired: true,
                        isCompleted: true
                    }
                ]
            }
        });
        assert.equal(signOffResponse.statusCode, 200, signOffResponse.body);
        const signOffBody = JSON.parse(signOffResponse.body);
        assert.deepEqual(signOffBody.data.deviceTypes.sort(), ["LAPTOP", "SERVER"]);

        const postCompletionUpdateResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/maintenance/windows/${windowId}`,
            headers: authHeader(tokens.admin),
            payload: { deviceTypes: ["DESKTOP_PC"] }
        });
        assert.equal(postCompletionUpdateResponse.statusCode, 200, postCompletionUpdateResponse.body);

        const historyServerFilter = await app.inject({
            method: "GET",
            url: "/api/v1/maintenance/completions/my-history?deviceType=SERVER",
            headers: authHeader(tokens.it)
        });
        assert.equal(historyServerFilter.statusCode, 200, historyServerFilter.body);
        const serverHistoryBody = JSON.parse(historyServerFilter.body);
        assert.ok(serverHistoryBody.data.some((entry) => entry.windowId === windowId));

        const historyDesktopFilter = await app.inject({
            method: "GET",
            url: "/api/v1/maintenance/completions/my-history?deviceType=DESKTOP_PC",
            headers: authHeader(tokens.it)
        });
        assert.equal(historyDesktopFilter.statusCode, 200, historyDesktopFilter.body);
        const desktopHistoryBody = JSON.parse(historyDesktopFilter.body);
        assert.equal(desktopHistoryBody.data.some((entry) => entry.windowId === windowId), false);
    });

    await t.test("RBAC blocks requester from creating and updating windows", async () => {
        const createResponse = await app.inject({
            method: "POST",
            url: "/api/v1/maintenance/windows",
            headers: authHeader(tokens.requester),
            payload: {
                cycleConfigId: cycleId,
                scheduledStartDate: new Date().toISOString(),
                deviceTypes: ["LAPTOP"]
            }
        });
        assert.equal(createResponse.statusCode, 403, createResponse.body);

        const updateResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/maintenance/windows/${windowId}`,
            headers: authHeader(tokens.requester),
            payload: { deviceTypes: ["SERVER"] }
        });
        assert.equal(updateResponse.statusCode, 403, updateResponse.body);
    });
});
