/* eslint-disable */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as repo from "../../apps/api/src/features/maintenance/repo.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

test("Maintenance Device Types - Repository Layer", async (t) => {
    let windowId;
    let userId;
    let cycleId;

    await t.test("Setup", async () => {
        // Create User
        const user = await prisma.user.create({
            data: {
                username: `device-type-repo-test-${randomUUID()}`,
                role: "it",
                status: "active"
            }
        });
        userId = user.id;

        // Create Cycle
        const cycle = await prisma.maintenanceCycleConfig.create({
            data: {
                name: `Cycle ${randomUUID()}`,
                intervalMonths: 3,
                isActive: true
            }
        });
        cycleId = cycle.id;
    });

    await t.test("createMaintenanceWindowWithDeviceTypes - Should create window and associate device types", async () => {
        const data = {
            cycleConfigId: cycleId,
            scheduledStartDate: new Date(),
            status: "SCHEDULED",
            deviceTypes: ["LAPTOP", "DESKTOP_PC"]
        };

        const window = await repo.createMaintenanceWindowWithDeviceTypes(userId, data);
        windowId = window.id;

        assert.ok(windowId);
        assert.equal(window.deviceTypes.length, 2);
        const types = window.deviceTypes.map(dt => dt.deviceType).sort();
        assert.deepEqual(types, ["DESKTOP_PC", "LAPTOP"]);
    });

    await t.test("getDeviceTypesForWindow - Should return list of device types", async () => {
        const deviceTypes = await repo.getDeviceTypesForWindow(windowId);
        assert.equal(deviceTypes.length, 2);
        assert.ok(deviceTypes.includes("LAPTOP"));
        assert.ok(deviceTypes.includes("DESKTOP_PC"));
    });

    await t.test("updateWindowDeviceTypes - Should replace existing device types", async () => {
        const updated = await repo.updateWindowDeviceTypes(windowId, ["SERVER"]);
        assert.equal(updated.deviceTypes.length, 1);
        assert.equal(updated.deviceTypes[0].deviceType, "SERVER");

        // Verify via simple get
        const deviceTypes = await repo.getDeviceTypesForWindow(windowId);
        assert.deepEqual(deviceTypes, ["SERVER"]);
    });

    await t.test("getWindowsByDeviceType - Should filter windows correctly", async () => {
        const windows = await repo.getWindowsByDeviceType("SERVER");
        const found = windows.find(w => w.id === windowId);
        assert.ok(found, "Should find the window associated with SERVER");

        const laptopWindows = await repo.getWindowsByDeviceType("LAPTOP");
        const notFound = laptopWindows.find(w => w.id === windowId);
        assert.strictEqual(notFound, undefined, "Should NOT find the window associated with LAPTOP");
    });

    await t.test("listMaintenanceWindows - Should include deviceTypes in result", async () => {
        const result = await repo.listMaintenanceWindows({ deviceType: "SERVER" });
        const found = result.data.find(w => w.id === windowId);
        assert.ok(found);
        assert.equal(found.deviceTypes.length, 1);
        assert.equal(found.deviceTypes[0].deviceType, "SERVER");
    });

    await t.test("Cleanup", async () => {
        if (windowId) await prisma.maintenanceWindow.delete({ where: { id: windowId } });
        if (cycleId) await prisma.maintenanceCycleConfig.delete({ where: { id: cycleId } });
        if (userId) await prisma.user.delete({ where: { id: userId } });
    });
});
