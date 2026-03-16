/* eslint-disable */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));

import { prisma } from "../../apps/api/src/shared/db/prisma.js";
import { updateWindowStatuses, calculateNextWindowDate, generateFutureWindows } from "../../apps/api/src/features/maintenance/scheduler.js";
import {
    createMaintenanceWindow,
    createCycleConfig,
    getWindowsNeedingUpcomingNotification,
    getMaintenanceWindowsByCycleId,
    updateWindowStatus
} from "../../apps/api/src/features/maintenance/repo.js";

const getTestUser = async () => {
    let user = await prisma.user.findFirst();
    if (!user) {
        user = await prisma.user.create({
            data: { username: `test-scheduler-${randomUUID()}`, role: 'it' }
        });
    }
    return user;
};

after(async () => {
    await prisma.$disconnect();
});

test("Scheduler Logic - Date Calculation", async (t) => {
    await t.test("calculateNextWindowDate handles month rollover", () => {
        const date = new Date("2024-01-31T00:00:00Z");
        const next = calculateNextWindowDate(date, 1);
        assert.ok(next > date, "Next date should be after start date");
        assert.equal(next.getFullYear(), 2024);
    });

    await t.test("calculateNextWindowDate handles leap-year day correctly", () => {
        const leapDate = new Date("2024-01-29T00:00:00Z");
        const next = calculateNextWindowDate(leapDate, 1);
        assert.equal(next.toISOString(), "2024-02-29T00:00:00.000Z");
    });
});

test("Scheduler Logic - Status Updates", async (t) => {
    const user = await getTestUser();
    const cycle = await createCycleConfig({
        name: `Status Test ${randomUUID()}`,
        intervalMonths: 3
    });

    const now = new Date();
    const pastDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
    const futureDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now (upcoming)
    const farFutureDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days from now (scheduled)

    const window1 = await createMaintenanceWindow({
        cycleConfigId: cycle.id,
        scheduledStartDate: pastDate,
        status: 'SCHEDULED',
        createdById: user.id
    });

    const window2 = await createMaintenanceWindow({
        cycleConfigId: cycle.id,
        scheduledStartDate: futureDate,
        status: 'SCHEDULED',
        createdById: user.id
    });

    const window3 = await createMaintenanceWindow({
        cycleConfigId: cycle.id,
        scheduledStartDate: farFutureDate,
        status: 'SCHEDULED',
        createdById: user.id
    });

    const statusUpdateResult = await updateWindowStatuses({ sendNotifications: false });

    const updated1 = await prisma.maintenanceWindow.findUnique({ where: { id: window1.id } });
    const updated2 = await prisma.maintenanceWindow.findUnique({ where: { id: window2.id } });
    const updated3 = await prisma.maintenanceWindow.findUnique({ where: { id: window3.id } });

    assert.equal(updated1.status, 'OVERDUE', "Past scheduled window should become OVERDUE");
    assert.equal(updated2.status, 'UPCOMING', "Near future scheduled window should become UPCOMING");
    assert.equal(updated3.status, 'SCHEDULED', "Far future window should remain SCHEDULED");
    assert.equal(statusUpdateResult.upcomingUpdatedCount, 1, "Only future windows inside 30 days should become UPCOMING");
    assert.equal(statusUpdateResult.overdueUpdatedCount, 1, "Only past windows should become OVERDUE");

    const upcomingWindows = await getWindowsNeedingUpcomingNotification(30);
    const upcomingIds = new Set(upcomingWindows.map((w) => w.id));
    assert.ok(upcomingIds.has(window2.id), "UPCOMING window inside 30 days should be eligible for notification");
    assert.ok(!upcomingIds.has(window3.id), "SCHEDULED window outside 30 days should not be eligible");

    await t.test("status updates handle more than one batch", async () => {
        const batchCycle = await createCycleConfig({
            name: `Batch Status ${randomUUID()}`,
            intervalMonths: 3
        });

        const baseDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.maintenanceWindow.createMany({
            data: Array.from({ length: 1005 }, (_, idx) => ({
                cycleConfigId: batchCycle.id,
                scheduledStartDate: new Date(baseDate.getTime() + idx * 60 * 1000),
                status: 'SCHEDULED',
                createdById: user.id
            }))
        });

        await updateWindowStatuses({ sendNotifications: false });

        const promoted = await prisma.maintenanceWindow.count({
            where: { cycleConfigId: batchCycle.id, status: 'UPCOMING' }
        });
        assert.equal(promoted, 1005, "All records across multiple batches should be updated");

        await prisma.maintenanceWindow.deleteMany({ where: { cycleConfigId: batchCycle.id } });
        await prisma.maintenanceCycleConfig.delete({ where: { id: batchCycle.id } });
    });

    // Cleanup
    await prisma.maintenanceWindow.deleteMany({ where: { cycleConfigId: cycle.id } });
    await prisma.maintenanceCycleConfig.delete({ where: { id: cycle.id } });
});

test("Scheduler Logic - Future Window Generation", async (t) => {
    const user = await getTestUser();
    const quarterlyCycle = await createCycleConfig({
        name: `Quarterly Gen ${randomUUID()}`,
        intervalMonths: 3
    });
    const biannualCycle = await createCycleConfig({
        name: `Biannual Gen ${randomUUID()}`,
        intervalMonths: 6
    });

    await t.test("quarterly interval produces 4 windows for 12 months", async () => {
        const windows = await generateFutureWindows(quarterlyCycle.id, 12, user.id);
        assert.equal(windows.length, 4);
    });

    await t.test("biannual interval produces 2 windows for 12 months", async () => {
        const windows = await generateFutureWindows(biannualCycle.id, 12, user.id);
        assert.equal(windows.length, 2);
    });

    await t.test("windows start from current date plus cycle interval and extend within 12 months", async () => {
        const result = await getMaintenanceWindowsByCycleId(quarterlyCycle.id, {
            orderBy: { scheduledStartDate: "asc" },
            limit: 10
        });
        const windows = result.data;
        assert.ok(windows.length >= 1);

        const first = new Date(windows[0].scheduledStartDate);
        const now = new Date();
        const earliestExpected = new Date(now);
        earliestExpected.setMonth(earliestExpected.getMonth() + 2);
        const latestExpected = new Date(now);
        latestExpected.setMonth(latestExpected.getMonth() + 4);

        assert.ok(first >= earliestExpected && first <= latestExpected, `first window ${first.toISOString()} out of expected range`);

        const finalWindow = new Date(windows[windows.length - 1].scheduledStartDate);
        const horizon = new Date(now);
        horizon.setMonth(horizon.getMonth() + 12);
        assert.ok(finalWindow <= horizon);
    });

    await t.test("next generation starts from last existing window and does not duplicate", async () => {
        const repeat = await generateFutureWindows(quarterlyCycle.id, 12, user.id);
        assert.equal(repeat.length, 0);
    });

    await t.test("completed windows remain COMPLETED after status update", async () => {
        const windowRes = await getMaintenanceWindowsByCycleId(biannualCycle.id, {
            orderBy: { scheduledStartDate: "asc" },
            limit: 1
        });
        const target = windowRes.data[0];
        assert.ok(target);

        await updateWindowStatus(target.id, "COMPLETED");
        await updateWindowStatuses({ sendNotifications: false });

        const updated = await prisma.maintenanceWindow.findUnique({ where: { id: target.id } });
        assert.equal(updated.status, "COMPLETED");
    });

    await prisma.maintenanceWindow.deleteMany({
        where: { cycleConfigId: { in: [quarterlyCycle.id, biannualCycle.id] } }
    });
    await prisma.maintenanceCycleConfig.deleteMany({
        where: { id: { in: [quarterlyCycle.id, biannualCycle.id] } }
    });
});
