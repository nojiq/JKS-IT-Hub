import { CronJob, AsyncTask } from "toad-scheduler";

export const createSyncJob = ({ syncService, logger, config }) => {
    const task = new AsyncTask(
        "ldap-daily-sync",
        async () => {
            logger.info("Starting scheduled LDAP sync");

            try {
                // Simple retry logic: 3 attempts with delay
                const MAX_RETRIES = 3;
                let attempt = 0;

                while (attempt < MAX_RETRIES) {
                    try {
                        attempt++;
                        await syncService.startScheduledSync();
                        logger.info({ attempt }, "Scheduled LDAP sync completed successfully");
                        return; // Success, exit
                    } catch (err) {
                        if (err.name === "LdapSyncInProgressError") {
                            logger.info("Scheduled sync skipped - sync already in progress");
                            return;
                        }

                        if (attempt >= MAX_RETRIES) {
                            throw err; // Re-throw to main error handler
                        }

                        // Exponential backoff: 5s, 10s, 20s...
                        const delay = 5000 * Math.pow(2, attempt - 1);
                        logger.warn({ err, attempt, delayMs: delay }, "Scheduled sync failed, retrying...");
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            } catch (err) {
                logger.error({ err }, "Failed to complete scheduled LDAP sync after retries");
                throw err;
            }
        },
        (err) => {
            // Error handler for the task
            logger.error({ err, alert: true, type: "ldap_sync_job_failure" }, "LDAP Sync Job Failed");
        }
    );


    // Use CronJob for specific time scheduling
    // Default: Run at 00:00:00 every day (Midnight)
    // Config format examples: '0 0 * * *' (Daily midnight), '0 2 * * *' (2 AM)
    const cronSchedule = config.ldapSync?.schedule || '0 0 * * *';

    // Note: toad-scheduler CronJob syntax
    const job = new CronJob(
        { cronExpression: cronSchedule },
        task,
        {
            id: "ldap-daily-sync-job",
            preventOverrun: true
        }
    );

    return job;
};
