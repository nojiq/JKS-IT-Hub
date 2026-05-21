/* eslint-disable */
import "./bootstrap-database-env.mjs";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");

import appPlugin from "../../apps/api/src/server.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";
import { getAuthConfig } from "../../apps/api/src/config/authConfig.js";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";

const authHeader = (token) => ({ cookie: `it-hub-session=${token}` });

let app;
let users;
let tokens;
const created = {
    presetTitles: [],
    userIds: [],
    profileIds: [],
    templateIds: []
};

const track = (key, value) => {
    created[key].push(value);
    return value;
};

before(async () => {
    app = Fastify();
    await app.register(appPlugin);
    const authConfig = getAuthConfig();

    users = {
        it: await prisma.user.create({
            data: {
                username: `it-task-presets-${randomUUID()}`,
                role: "it",
                status: "active"
            }
        }),
        admin: await prisma.user.create({
            data: {
                username: `admin-task-presets-${randomUUID()}`,
                role: "admin",
                status: "active"
            }
        }),
        requester: await prisma.user.create({
            data: {
                username: `requester-task-presets-${randomUUID()}`,
                role: "requester",
                status: "active"
            }
        })
    };
    track("userIds", users.it.id);
    track("userIds", users.admin.id);
    track("userIds", users.requester.id);

    tokens = {
        it: await signSessionToken({
            subject: users.it.id,
            payload: { username: users.it.username, role: users.it.role }
        }, authConfig.jwt),
        admin: await signSessionToken({
            subject: users.admin.id,
            payload: { username: users.admin.username, role: users.admin.role }
        }, authConfig.jwt),
        requester: await signSessionToken({
            subject: users.requester.id,
            payload: { username: users.requester.username, role: users.requester.role }
        }, authConfig.jwt)
    };
});

after(async () => {
    try {
        await prisma.maintenanceProfile.updateMany({
            where: { id: { in: created.profileIds } },
            data: { activeTemplateId: null }
        }).catch(() => {});
        await prisma.checklistItem.deleteMany({ where: { templateId: { in: created.templateIds } } }).catch(() => {});
        await prisma.checklistTemplate.deleteMany({ where: { id: { in: created.templateIds } } }).catch(() => {});
        await prisma.maintenanceProfile.deleteMany({ where: { id: { in: created.profileIds } } }).catch(() => {});
        for (const title of created.presetTitles) {
            await prisma.$executeRawUnsafe("DELETE FROM maintenance_task_presets WHERE title = ?", title).catch(() => {});
        }
        await prisma.user.deleteMany({ where: { id: { in: created.userIds } } }).catch(() => {});
    } finally {
        await app?.close().catch(() => {});
        await prisma.$disconnect().catch(() => {});
    }
});

test("maintenance task presets can be created, found, and soft deleted by IT users", async () => {
    const title = track("presetTitles", `USB ports ${randomUUID()}`);

    const createResponse = await app.inject({
        method: "POST",
        url: "/api/v1/maintenance/task-presets",
        headers: authHeader(tokens.it),
        payload: {
            title,
            description: "Check every USB port with a working device.",
            category: "Hardware"
        }
    });
    assert.equal(createResponse.statusCode, 201, createResponse.body);
    const createdPreset = JSON.parse(createResponse.body).data;
    assert.equal(createdPreset.title, title);
    assert.equal(createdPreset.description, "Check every USB port with a working device.");
    assert.equal(createdPreset.category, "Hardware");
    assert.equal(createdPreset.isActive, true);

    const searchResponse = await app.inject({
        method: "GET",
        url: `/api/v1/maintenance/task-presets?search=${encodeURIComponent(title)}`,
        headers: authHeader(tokens.it)
    });
    assert.equal(searchResponse.statusCode, 200, searchResponse.body);
    const searchBody = JSON.parse(searchResponse.body);
    assert.equal(searchBody.data.length, 1);
    assert.equal(searchBody.data[0].id, createdPreset.id);

    const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/api/v1/maintenance/task-presets/${createdPreset.id}`,
        headers: authHeader(tokens.it)
    });
    assert.equal(deleteResponse.statusCode, 200, deleteResponse.body);
    assert.equal(JSON.parse(deleteResponse.body).data.isActive, false);

    const defaultListResponse = await app.inject({
        method: "GET",
        url: `/api/v1/maintenance/task-presets?search=${encodeURIComponent(title)}`,
        headers: authHeader(tokens.it)
    });
    assert.equal(defaultListResponse.statusCode, 200, defaultListResponse.body);
    assert.equal(JSON.parse(defaultListResponse.body).data.length, 0);

    const inactiveListResponse = await app.inject({
        method: "GET",
        url: `/api/v1/maintenance/task-presets?includeInactive=true&search=${encodeURIComponent(title)}`,
        headers: authHeader(tokens.it)
    });
    assert.equal(inactiveListResponse.statusCode, 200, inactiveListResponse.body);
    assert.equal(JSON.parse(inactiveListResponse.body).data[0].isActive, false);
});

test("saving a checklist with a new task title adds it to the shared catalog", async () => {
    const title = track("presetTitles", `Thermal paste check ${randomUUID()}`);
    const profileName = `Task preset profile ${randomUUID()}`;

    const createProfileResponse = await app.inject({
        method: "POST",
        url: "/api/v1/maintenance/profiles",
        headers: authHeader(tokens.admin),
        payload: {
            name: profileName,
            intervalMonths: 3,
            checklistItems: [
                {
                    title,
                    description: "Check temperature and replace paste only when needed.",
                    required: true,
                    evidenceRequired: false
                }
            ]
        }
    });
    assert.equal(createProfileResponse.statusCode, 201, createProfileResponse.body);
    const createdProfile = JSON.parse(createProfileResponse.body).data;
    track("profileIds", createdProfile.id);
    track("templateIds", createdProfile.checklistTemplate.id);
    assert.equal(createdProfile.checklistTemplate.items[0].taskPresetId != null, true);

    const listResponse = await app.inject({
        method: "GET",
        url: `/api/v1/maintenance/task-presets?search=${encodeURIComponent(title)}`,
        headers: authHeader(tokens.it)
    });
    assert.equal(listResponse.statusCode, 200, listResponse.body);
    const preset = JSON.parse(listResponse.body).data[0];
    assert.equal(preset.title, title);
    assert.equal(preset.description, "Check temperature and replace paste only when needed.");
});

test("maintenance run items accept repair as a completion result", async () => {
    const user = users.it;
    const asset = await prisma.asset.create({
        data: {
            snipeAssetId: Math.floor(Math.random() * 1000000000),
            assetTag: `TASK-PRESET-${randomUUID()}`,
            name: "Preset test asset"
        }
    });

    const profile = await prisma.maintenanceProfile.create({
        data: {
            name: `Repair status profile ${randomUUID()}`,
            intervalMonths: 3
        }
    });
    track("profileIds", profile.id);
    const template = await prisma.checklistTemplate.create({
        data: {
            profileId: profile.id,
            name: `Repair status checklist ${randomUUID()}`,
            version: 1,
            items: {
                create: [{
                    sortOrder: 0,
                    title: "Keyboard",
                    required: true,
                    evidenceRequired: false
                }]
            }
        }
    });
    track("templateIds", template.id);
    await prisma.maintenanceProfile.update({
        where: { id: profile.id },
        data: { activeTemplateId: template.id }
    });
    const assignment = await prisma.maintenanceAssignment.create({
        data: {
            profileId: profile.id,
            assetId: asset.id,
            userId: user.id,
            status: "active",
            startDate: new Date(),
            activeKey: `${asset.id}:${profile.id}`
        }
    });
    const run = await prisma.maintenanceRun.create({
        data: {
            assignmentId: assignment.id,
            profileId: profile.id,
            assetId: asset.id,
            userId: user.id,
            checklistTemplateId: template.id,
            checklistVersion: 1,
            dueDate: new Date(),
            status: "scheduled",
            items: {
                create: [{
                    sortOrder: 0,
                    title: "Keyboard",
                    required: true,
                    evidenceRequired: false
                }]
            }
        },
        include: { items: true }
    });

    const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/maintenance/runs/items/${run.items[0].id}`,
        headers: authHeader(tokens.it),
        payload: {
            status: "repair",
            notes: "Cleaned key switch and tested input."
        }
    });
    assert.equal(response.statusCode, 200, response.body);
    const item = JSON.parse(response.body).data.items[0];
    assert.equal(item.status, "repair");
    assert.equal(item.notes, "Cleaned key switch and tested input.");

    await prisma.maintenanceRunItem.deleteMany({ where: { runId: run.id } });
    await prisma.maintenanceRun.delete({ where: { id: run.id } });
    await prisma.maintenanceAssignment.delete({ where: { id: assignment.id } });
    await prisma.asset.delete({ where: { id: asset.id } });
});
