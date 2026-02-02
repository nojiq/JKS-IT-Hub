import { describe, it, after } from "node:test";
import assert from "node:assert";
import { createAuditLog, prisma } from "../../apps/api/src/features/audit/repo.js";
import { createSyncRun } from "../../apps/api/src/features/ldap/repo.js";

after(async () => {
    await prisma.$disconnect();
});

describe("Schema Nullability Support", () => {
    it("should allow creating an audit log with null actorUserId", async () => {
        const log = await createAuditLog({
            action: "test.null.actor",
            actorUserId: null,
            entityType: "test",
            entityId: "123",
            metadata: {}
        });
        assert.ok(log);
        assert.strictEqual(log.actorUserId, null);
    });

    it("should allow creating a sync run with null triggeredByUserId", async () => {
        const run = await createSyncRun({
            status: "started",
            triggeredByUserId: null
        });
        assert.ok(run);
        assert.strictEqual(run.triggeredByUserId, null);
    });
});
