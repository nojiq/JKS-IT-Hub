import { CronJob, AsyncTask } from "toad-scheduler";
import * as scheduler from "./scheduler.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Factory function for job
export const createMaintenanceJob = ({ logger, config }) => {
    if (config?.maintenance?.enabled === false) {
        logger.info("Maintenance scheduled job disabled by config");
        return null;
    }

    const maxAttempts = Math.max(1, Number(config?.maintenance?.retryAttempts ?? 3));
    const retryDelayMs = Math.max(0, Number(config?.maintenance?.retryDelayMs ?? 1000));

    const task = new AsyncTask(
        "maintenance-status-update",
        async () => {
            logger.info("Starting maintenance window status update job");
            let attempt = 0;
            while (attempt < maxAttempts) {
                attempt += 1;
                try {
                    const result = await scheduler.updateWindowStatuses();
                    logger.info({ result, attempt, maxAttempts }, "Maintenance status update completed");
                    return;
                } catch (err) {
                    if (attempt >= maxAttempts) {
                        logger.error({ err, attempt, maxAttempts }, "Failed to update maintenance window statuses");
                        throw err;
                    }
                    const backoffMs = retryDelayMs * Math.pow(2, attempt - 1);
                    logger.warn(
                        { err, attempt, maxAttempts, retryInMs: backoffMs },
                        "Maintenance status update failed; retrying"
                    );
                    if (backoffMs > 0) {
                        await delay(backoffMs);
                    }
                }
            }
        },
        (err) => {
            logger.error({ err, alert: true, type: "maintenance_job_failure" }, "Maintenance Job Failed");
        }
    );

    const cronSchedule = config?.maintenance?.schedule || '0 0 * * *';
    const timezone = config?.maintenance?.timezone || 'UTC';

    const job = new CronJob(
        { cronExpression: cronSchedule, timezone },
        task,
        {
            id: "maintenance-status-update-job",
            preventOverrun: true
        }
    );

    return job;
};
