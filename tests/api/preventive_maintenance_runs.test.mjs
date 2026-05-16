/* eslint-disable */
import "./bootstrap-database-env.mjs";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { prisma } from "../../apps/api/src/shared/db/prisma.js";
import {
    addMonthsClamped,
    dailyPreventiveMaintenanceJob
} from "../../apps/api/src/features/maintenance/preventiveScheduler.js";
import {
    completeMaintenanceRun,
    startMaintenanceRun,
    updateMaintenanceRunItem
} from "../../apps/api/src/features/maintenance/preventiveRunService.js";

const created = {
    runIds: [],
    assignmentIds: [],
    profileIds: [],
    templateIds: [],
    assetIds: [],
    userIds: []
};

const track = (key, id) => {
    created[key].push(id);
    return id;
};

const makeUser = async (prefix = "pm-user") => {
    const user = await prisma.user.create({
        data: {
            username: `${prefix}-${randomUUID()}`,
            role: "it"
        }
    });
    track("userIds", user.id);
    return user;
};

const makeAsset = async (prefix = "PM") => {
    const asset = await prisma.asset.create({
        data: {
            snipeAssetId: Math.floor(Math.random() * 1000000000),
            assetTag: `${prefix}-${randomUUID()}`,
            name: "Preventive maintenance test asset"
        }
    });
    track("assetIds", asset.id);
    return asset;
};

const makeProfileWithTemplate = async ({ intervalMonths = 3, gracePeriodDays = 0 } = {}) => {
    const profile = await prisma.maintenanceProfile.create({
        data: {
            name: `PM Profile ${randomUUID()}`,
            intervalMonths,
            gracePeriodDays
        }
    });
    track("profileIds", profile.id);

    const template = await prisma.checklistTemplate.create({
        data: {
            profileId: profile.id,
            name: `PM Checklist ${randomUUID()}`,
            version: 1,
            items: {
                create: [
                    {
                        sortOrder: 0,
                        title: "Inspect asset",
                        required: true,
                        evidenceRequired: false
                    },
                    {
                        sortOrder: 1,
                        title: "Record condition",
                        required: false,
                        evidenceRequired: true
                    }
                ]
            }
        }
    });
    track("templateIds", template.id);

    await prisma.maintenanceProfile.update({
        where: { id: profile.id },
        data: { activeTemplateId: template.id }
    });

    return { profile, template };
};

const makeAssignment = async ({ profileId, userId, assetId, startDate, status = "active" }) => {
    const assignment = await prisma.maintenanceAssignment.create({
        data: {
            profileId,
            userId,
            assetId,
            status,
            startDate,
            activeKey: status === "active" ? `${assetId}:${profileId}` : null
        }
    });
    track("assignmentIds", assignment.id);
    return assignment;
};

after(async () => {
    await prisma.maintenanceRunItem.deleteMany({
        where: { runId: { in: created.runIds } }
    });
    await prisma.maintenanceRun.deleteMany({
        where: {
            OR: [
                { id: { in: created.runIds } },
                { assignmentId: { in: created.assignmentIds } }
            ]
        }
    });
    await prisma.maintenanceAssignment.deleteMany({ where: { id: { in: created.assignmentIds } } });
    await prisma.maintenanceProfile.updateMany({
        where: { id: { in: created.profileIds } },
        data: { activeTemplateId: null }
    });
    await prisma.checklistItem.deleteMany({ where: { templateId: { in: created.templateIds } } });
    await prisma.checklistTemplate.deleteMany({ where: { id: { in: created.templateIds } } });
    await prisma.maintenanceProfile.deleteMany({ where: { id: { in: created.profileIds } } });
    await prisma.asset.deleteMany({ where: { id: { in: created.assetIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    await prisma.$disconnect();
});

test("preventive maintenance scheduler creates first due run inside 30-day window", async () => {
    const user = await makeUser();
    const asset = await makeAsset();
    const { profile, template } = await makeProfileWithTemplate({ intervalMonths: 3 });
    const assignment = await makeAssignment({
        profileId: profile.id,
        userId: user.id,
        assetId: asset.id,
        startDate: new Date("2026-01-01T00:00:00.000Z")
    });

    const result = await dailyPreventiveMaintenanceJob({
        now: new Date("2026-03-15T10:00:00.000Z"),
        windowDays: 30,
        sendNotifications: false
    });

    assert.equal(result.createdCount, 1);
    const run = await prisma.maintenanceRun.findFirst({
        where: { assignmentId: assignment.id },
        include: { items: { orderBy: { sortOrder: "asc" } } }
    });
    track("runIds", run.id);

    assert.equal(run.dueDate.toISOString(), "2026-04-01T00:00:00.000Z");
    assert.equal(run.status, "scheduled");
    assert.equal(run.checklistTemplateId, template.id);
    assert.equal(run.checklistVersion, 1);
    assert.equal(run.items.length, 2);
    assert.equal(run.items[0].title, "Inspect asset");
    assert.equal(run.items[1].evidenceRequired, true);
});

test("preventive maintenance scheduler uses completedAt drift instead of previous dueDate", async () => {
    const user = await makeUser();
    const asset = await makeAsset();
    const { profile, template } = await makeProfileWithTemplate({ intervalMonths: 3 });
    const assignment = await makeAssignment({
        profileId: profile.id,
        userId: user.id,
        assetId: asset.id,
        startDate: new Date("2026-01-01T00:00:00.000Z")
    });

    const completedRun = await prisma.maintenanceRun.create({
        data: {
            assignmentId: assignment.id,
            profileId: profile.id,
            assetId: asset.id,
            userId: user.id,
            checklistTemplateId: template.id,
            checklistVersion: 1,
            dueDate: new Date("2026-04-01T00:00:00.000Z"),
            completedAt: new Date("2026-04-20T12:00:00.000Z"),
            completedById: user.id,
            status: "completed"
        }
    });
    track("runIds", completedRun.id);

    const result = await dailyPreventiveMaintenanceJob({
        now: new Date("2026-07-01T00:00:00.000Z"),
        windowDays: 30,
        sendNotifications: false
    });

    assert.equal(result.createdCount, 1);
    const runs = await prisma.maintenanceRun.findMany({
        where: { assignmentId: assignment.id },
        orderBy: { dueDate: "asc" }
    });
    runs.forEach((run) => track("runIds", run.id));

    assert.equal(runs.at(-1).dueDate.toISOString(), "2026-07-20T12:00:00.000Z");
});

test("preventive maintenance scheduler does not duplicate open runs or archived assignments", async () => {
    const user = await makeUser();
    const activeAsset = await makeAsset("PM-ACTIVE");
    const archivedAsset = await makeAsset("PM-ARCHIVED");
    const { profile, template } = await makeProfileWithTemplate({ intervalMonths: 3 });

    const activeAssignment = await makeAssignment({
        profileId: profile.id,
        userId: user.id,
        assetId: activeAsset.id,
        startDate: new Date("2026-01-01T00:00:00.000Z")
    });
    await makeAssignment({
        profileId: profile.id,
        userId: user.id,
        assetId: archivedAsset.id,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        status: "archived"
    });

    const openRun = await prisma.maintenanceRun.create({
        data: {
            assignmentId: activeAssignment.id,
            profileId: profile.id,
            assetId: activeAsset.id,
            userId: user.id,
            checklistTemplateId: template.id,
            checklistVersion: 1,
            dueDate: new Date("2026-04-01T00:00:00.000Z"),
            status: "scheduled"
        }
    });
    track("runIds", openRun.id);

    const result = await dailyPreventiveMaintenanceJob({
        now: new Date("2026-03-15T00:00:00.000Z"),
        windowDays: 30,
        sendNotifications: false
    });

    assert.equal(result.createdCount, 0);
    const runCount = await prisma.maintenanceRun.count({
        where: { profileId: profile.id }
    });
    assert.equal(runCount, 1);
});

test("preventive maintenance scheduler date helper clamps month-end dates", () => {
    assert.equal(
        addMonthsClamped(new Date("2026-01-31T00:00:00.000Z"), 1).toISOString(),
        "2026-02-28T00:00:00.000Z"
    );
});

test("preventive maintenance run service supports partial progress then completion", async () => {
    const user = await makeUser();
    const asset = await makeAsset("PM-SERVICE");
    const { profile } = await makeProfileWithTemplate({ intervalMonths: 3 });
    const assignment = await makeAssignment({
        profileId: profile.id,
        userId: user.id,
        assetId: asset.id,
        startDate: new Date("2026-01-01T00:00:00.000Z")
    });

    await dailyPreventiveMaintenanceJob({
        now: new Date("2026-03-15T00:00:00.000Z"),
        windowDays: 30,
        sendNotifications: false
    });

    const run = await prisma.maintenanceRun.findFirst({
        where: { assignmentId: assignment.id },
        include: { items: { orderBy: { sortOrder: "asc" } } }
    });
    track("runIds", run.id);

    const started = await startMaintenanceRun(run.id, user.id, {
        now: new Date("2026-03-16T08:00:00.000Z")
    });
    assert.equal(started.status, "in_progress");
    assert.equal(started.startedAt.toISOString(), "2026-03-16T08:00:00.000Z");

    const item = await updateMaintenanceRunItem(run.items[0].id, {
        status: "pass",
        notes: "Inspected successfully"
    }, user.id, {
        now: new Date("2026-03-16T09:00:00.000Z")
    });
    assert.equal(item.status, "pass");
    assert.equal(item.completedById, user.id);
    assert.equal(item.completedAt.toISOString(), "2026-03-16T09:00:00.000Z");

    const completed = await completeMaintenanceRun(run.id, user.id, {
        now: new Date("2026-03-17T10:00:00.000Z")
    });
    assert.equal(completed.status, "completed");
    assert.equal(completed.completedById, user.id);
    assert.equal(completed.completedAt.toISOString(), "2026-03-17T10:00:00.000Z");
});

test("preventive maintenance run service blocks completion while required items are pending", async () => {
    const user = await makeUser();
    const asset = await makeAsset("PM-BLOCK");
    const { profile } = await makeProfileWithTemplate({ intervalMonths: 3 });
    const assignment = await makeAssignment({
        profileId: profile.id,
        userId: user.id,
        assetId: asset.id,
        startDate: new Date("2026-01-01T00:00:00.000Z")
    });

    await dailyPreventiveMaintenanceJob({
        now: new Date("2026-03-15T00:00:00.000Z"),
        windowDays: 30,
        sendNotifications: false
    });

    const run = await prisma.maintenanceRun.findFirst({
        where: { assignmentId: assignment.id }
    });
    track("runIds", run.id);

    await assert.rejects(
        () => completeMaintenanceRun(run.id, user.id),
        /Required checklist items are still pending/
    );
});
