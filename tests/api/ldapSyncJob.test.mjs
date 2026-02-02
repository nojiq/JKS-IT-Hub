import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { createSyncJob } from "../../apps/api/src/features/ldap/syncJob.js";

describe("LDAP Scheduled Sync Job", () => {
    it("should create a job with correct configuration", () => {
        const syncService = {};
        const logger = { info: () => { }, error: () => { } };
        const config = { ldapSync: { schedule: '0 0 * * *' } };

        const job = createSyncJob({ syncService, logger, config });

        assert.ok(job);
        assert.ok(job);
        assert.strictEqual(job.id, "ldap-daily-sync-job");
        // Verify it's a cron job (checking private or public props depending on toad-scheduler version, or just existence)
        assert.ok(job.cronExpression || job.schedule, "Job should have a cron schedule");
    });

    it("should run sync successfully", async () => {
        const startScheduledSync = mock.fn(async () => { });
        const syncService = { startScheduledSync };
        const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn() };
        const config = { ldapSync: {} };

        const job = createSyncJob({ syncService, logger, config });
        const task = job.task;

        // Manually execute the task handler
        await task.handler();

        assert.strictEqual(startScheduledSync.mock.callCount(), 1);
        assert.strictEqual(logger.info.mock.callCount(), 2); // Start message + success message
    });

    it("should retry on failure and succeed", async () => {
        let callCount = 0;
        const startScheduledSync = mock.fn(async () => {
            callCount++;
            if (callCount < 2) throw new Error("Connection failed");
        });

        const syncService = { startScheduledSync };
        const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn() };
        const config = { ldapSync: {} };

        const job = createSyncJob({ syncService, logger, config });
        const task = job.task;

        // We override setTimeout to avoid waiting 5s in test
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = (fn) => fn();

        try {
            await task.handler();
        } finally {
            global.setTimeout = originalSetTimeout;
        }

        assert.strictEqual(startScheduledSync.mock.callCount(), 2);
        assert.strictEqual(logger.warn.mock.callCount(), 1); // 1 retry warning
        assert.strictEqual(logger.info.mock.callCount(), 2); // Start + success
    });

    it("should give up after max retries and log error", async () => {
        const startScheduledSync = mock.fn(async () => {
            throw new Error("Persistent failure");
        });

        const syncService = { startScheduledSync };
        const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn() };
        const config = { ldapSync: {} };

        const job = createSyncJob({ syncService, logger, config });
        const task = job.task;

        const originalSetTimeout = global.setTimeout;
        global.setTimeout = (fn) => fn();

        try {
            await task.handler();
            assert.fail("Should have thrown");
        } catch (err) {
            assert.strictEqual(err.message, "Persistent failure");
        } finally {
            global.setTimeout = originalSetTimeout;
        }

        // 3 attempts total (initial + 2 retries is standard, logic says attempt < MAX_RETRIES (3) -> 1, 2, 3 attempts)
        assert.strictEqual(startScheduledSync.mock.callCount(), 3);
        assert.strictEqual(logger.warn.mock.callCount(), 2); // 2 warnings (after 1st and 2nd failure)
        assert.strictEqual(logger.error.mock.callCount(), 1); // Final error
    });
});
