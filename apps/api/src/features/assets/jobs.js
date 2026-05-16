import { CronJob, AsyncTask } from "toad-scheduler";

export const createAssetSyncJob = ({ assetService, logger, config }) => {
  if (!assetService?.isEnabled?.()) {
    logger.info("Asset sync job disabled by config");
    return null;
  }

  const task = new AsyncTask(
    "snipe-it-asset-sync",
    async () => {
      logger.info("Starting Snipe-IT asset sync");
      const result = await assetService.syncAssets();
      logger.info({ result }, "Snipe-IT asset sync completed");
    },
    (err) => {
      logger.error({ err, alert: true, type: "asset_sync_job_failure" }, "Asset Sync Job Failed");
    }
  );

  return new CronJob(
    { cronExpression: config?.snipeIt?.schedule || "0 */6 * * *" },
    task,
    {
      id: "snipe-it-asset-sync-job",
      preventOverrun: true
    }
  );
};
