import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createAuditLog, getAuditLogs, prisma } from "../../apps/api/src/features/audit/repo.js";
import { createUser } from "../../apps/api/src/features/users/repo.js";

after(async () => {
    await prisma.$disconnect();
});
import { randomUUID } from "node:crypto";

test("getAuditLogs retrieves logs with pagination and filtering", async () => {
    // Create actual users for FK constraints
    const actor1 = await createUser({ username: `audit-test-actor-1-${randomUUID()}`, role: "it" });
    const actor2 = await createUser({ username: `audit-test-actor-2-${randomUUID()}`, role: "it" });

    const actorId = actor1.id;
    const action = `test.action.${randomUUID()}`;
    const testId = randomUUID();

    // Create 3 logs
    // 1. Matches actor and action
    await createAuditLog({
        action,
        actorUserId: actorId,
        entityType: "test",
        entityId: `${testId}-1`,
        metadata: { index: 1 }
    });

    // 2. Matches actor, different action
    await createAuditLog({
        action: "other.action",
        actorUserId: actorId,
        entityType: "test",
        entityId: `${testId}-2`,
        metadata: { index: 2 }
    });

    // 3. Different actor, matches action
    await createAuditLog({
        action,
        actorUserId: actor2.id,
        entityType: "test",
        entityId: `${testId}-3`,
        metadata: { index: 3 }
    });

    // Test 1: No filters
    const all = await getAuditLogs({ limit: 10 });
    assert.ok(all.logs.length >= 3);
    assert.ok(typeof all.total === 'number');

    // Test 2: Filter by Actor
    const byActor = await getAuditLogs({ actorId, limit: 10 });
    // Should verify we strictly find matches. Since we used unique actorId (from newly created user), 
    // we expect exactly matching counts UNLESS previous tests reused same actorId (unlikely with UUIDs).
    // But `count` queries db. If DB is shared, it might have more.
    // However, actor1 is new. So should be exactly 2.
    assert.equal(byActor.total, 2);
    assert.equal(byActor.logs.length, 2);
    assert.equal(byActor.logs[0].actorUserId, actorId);

    // Test 3: Filter by Action
    const byAction = await getAuditLogs({ action, limit: 10 });
    // Matches 1 and 3 - should be exactly 2 for our newly created unique action
    // Filter to only our test logs to avoid interference from other tests
    const ourActionLogs = byAction.logs.filter(l => l.entityType === 'test' && (l.entityId === `${testId}-1` || l.entityId === `${testId}-3`));
    assert.equal(ourActionLogs.length, 2, 'Should find exactly 2 logs with our test action');

    // Test 4: Pagination
    // We have at least 3 logs total (probably more).
    const paged = await getAuditLogs({ page: 1, limit: 1 });
    assert.equal(paged.logs.length, 1);

    // Test 5: Date Range
    // All created just now.
    const now = new Date();
    const past = new Date(now.getTime() - 10000);
    const future = new Date(now.getTime() + 10000);

    const byDate = await getAuditLogs({ startDate: past.toISOString(), endDate: future.toISOString(), limit: 10 });
    // Should find our logs
    const foundDateLogs = byDate.logs.filter(l => l.entityType === 'test' && [`${testId}-1`, `${testId}-2`, `${testId}-3`].includes(l.entityId));
    assert.equal(foundDateLogs.length, 3);
});
