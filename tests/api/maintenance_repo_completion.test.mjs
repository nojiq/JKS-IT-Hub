/* eslint-disable */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as repo from "../../apps/api/src/features/maintenance/repo.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

test("Maintenance Completion - Repository Layer", async (t) => {
    let windowId;
    let userId;
    let checklistItemId;
    let completionId;

    // Setup
    await t.test("Setup", async () => {
        // Create User
        const user = await prisma.user.create({
            data: {
                username: `completion-repo-test-${randomUUID()}`,
                role: "it",
                status: "active"
            }
        });
        userId = user.id;

        // Create Cycle
        const cycle = await repo.createCycleConfig({
            name: `Cycle ${randomUUID()}`,
            intervalMonths: 3,
            isActive: true
        });

        // Create Checklist Template
        const template = await repo.createChecklistTemplate({
            name: `Checklist ${randomUUID()}`,
            items: [
                { title: "Item 1", isRequired: true, orderIndex: 0 },
                { title: "Item 2", isRequired: false, orderIndex: 1 }
            ]
        });
        checklistItemId = template.items[0].id; // We'll use this ID

        // Create Window
        const window = await repo.createMaintenanceWindow({
            cycleConfigId: cycle.id,
            scheduledStartDate: new Date(),
            status: "SCHEDULED",
            createdById: userId,
            checklistTemplateId: template.id,
            checklistVersion: template.version,
            // Assignment
            assignedToId: userId
        });
        windowId = window.id;
    });

    await t.test("createCompletion - Should create completion record and update window status", async () => {
        const notes = "Repo test completion notes";
        const completedItems = [
            {
                checklistItemId: checklistItemId,
                itemTitle: "Item 1",
                isRequired: true,
                isCompleted: true
            }
        ];

        const completion = await repo.createCompletion(windowId, userId, notes, completedItems);

        assert.ok(completion.id);
        assert.equal(completion.windowId, windowId);
        assert.equal(completion.completedById, userId);
        assert.equal(completion.notes, notes);
        assert.equal(completion.checklistItems.length, 1);
        assert.equal(completion.checklistItems[0].checklistItemId, checklistItemId);
        assert.equal(completion.window.status, "COMPLETED");

        completionId = completion.id;
    });

    await t.test("getCompletionByWindowId - Should return completion details", async () => {
        const completion = await repo.getCompletionByWindowId(windowId);
        assert.ok(completion);
        assert.equal(completion.id, completionId);
        assert.equal(completion.completedBy.id, userId);
        assert.equal(completion.checklistItems.length, 1);
    });

    await t.test("getCompletionsByUserId - Should return user history", async () => {
        const result = await repo.getCompletionsByUserId(userId);
        assert.ok(result.data.length > 0);
        const completion = result.data.find(c => c.id === completionId);
        assert.ok(completion);
        assert.equal(completion.windowId, windowId);
    });

    await t.test("updateCompletionNotes - Should update notes", async () => {
        const newNotes = "Updated notes";
        const updated = await repo.updateCompletionNotes(completionId, newNotes);
        assert.equal(updated.notes, newNotes);
    });

    // Cleanup
    await t.test("Cleanup", async () => {
        if (completionId) {
            await prisma.checklistItemCompletion.deleteMany({ where: { completionId } });
            await prisma.maintenanceCompletion.delete({ where: { id: completionId } });
        }
        if (windowId) {
            await prisma.maintenanceWindow.delete({ where: { id: windowId } });
        }
        // Cleanup other entities if needed, but cascade delete might handle some?
        // Actually, user and cycle might remain. Cleanup is good practice.
        await prisma.user.delete({ where: { id: userId } });
    });
});
