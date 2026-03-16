import test from "node:test";
import assert from "node:assert/strict";
import { emitRequestCreated, emitRequestUpdated, emitRequestStatusChanged } from "../../apps/api/src/features/requests/events.js";

test("Requests SSE Events Module", async (t) => {
    await t.test("exports required functions", async () => {
        assert.equal(typeof emitRequestCreated, 'function');
        assert.equal(typeof emitRequestUpdated, 'function');
        assert.equal(typeof emitRequestStatusChanged, 'function');
    });
});
