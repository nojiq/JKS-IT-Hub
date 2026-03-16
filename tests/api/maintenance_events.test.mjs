import test from "node:test";
import assert from "node:assert/strict";
import { emitMaintenanceStatusChanged, emitMaintenanceCompleted } from "../../apps/api/src/features/maintenance/events.js";

test("Maintenance SSE Events Module", async (t) => {
    await t.test("exports required functions", async () => {
        assert.equal(typeof emitMaintenanceStatusChanged, 'function');
        assert.equal(typeof emitMaintenanceCompleted, 'function');
    });
});
