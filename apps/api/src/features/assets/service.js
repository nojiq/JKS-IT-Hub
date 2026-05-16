import { normalizeSnipeAsset } from "./normalizer.js";

const AUTO_MATCHED_SOURCES = new Set(["auto_username", "auto_email", "manual"]);

export const createAssetService = ({ repo, client, userRepo, logger = console, now = () => new Date(), enabled = true }) => {
  const isConfigured = () => Boolean(client?.isConfigured?.());
  const isEnabled = () => enabled !== false && isConfigured();

  const resolveAssignment = async (normalized) => {
    if (!normalized.assignmentFingerprint) {
      return { assignedToUserId: null, assignmentSource: "unassigned" };
    }

    if (normalized.snipeAssignedType !== "user") {
      return { assignedToUserId: null, assignmentSource: "non_user" };
    }

    const usernameMatch = await repo.findUserByUsernameInsensitive(normalized.snipeAssignedUsername);
    if (usernameMatch) {
      return { assignedToUserId: usernameMatch.id, assignmentSource: "auto_username" };
    }

    const emailMatch = await repo.findUserByEmailInsensitive(normalized.snipeAssignedEmail);
    if (emailMatch) {
      return { assignedToUserId: emailMatch.id, assignmentSource: "auto_email" };
    }

    return { assignedToUserId: null, assignmentSource: "unmatched" };
  };

  const resolveSyncAssignment = async (existing, normalized) => {
    if (
      existing?.assignmentSource === "manual" &&
      existing.assignmentFingerprint === normalized.assignmentFingerprint
    ) {
      return { assignedToUserId: existing.assignedToUserId, assignmentSource: "manual" };
    }

    return resolveAssignment(normalized);
  };

  const syncAssets = async () => {
    if (!isEnabled()) {
      throw new Error("Snipe-IT sync is not configured");
    }

    const run = await repo.createSyncRun();
    const summary = {
      fetchedCount: 0,
      upsertedCount: 0,
      matchedCount: 0,
      unmatchedCount: 0
    };

    try {
      const rows = await client.fetchAllHardware();
      summary.fetchedCount = rows.length;
      const syncedAt = now();

      for (const row of rows) {
        const normalized = normalizeSnipeAsset(row, syncedAt);
        const existing = await repo.findAssetBySnipeAssetId(normalized.snipeAssetId);
        const assignment = await resolveSyncAssignment(existing, normalized);
        await repo.upsertAsset({ ...normalized, ...assignment });
        summary.upsertedCount += 1;
        if (AUTO_MATCHED_SOURCES.has(assignment.assignmentSource)) {
          summary.matchedCount += 1;
        } else if (assignment.assignmentSource === "unmatched") {
          summary.unmatchedCount += 1;
        }
      }

      await repo.completeSyncRun(run.id, summary);
      return summary;
    } catch (error) {
      await repo.failSyncRun(run.id, error).catch((failError) => {
        logger.error?.({ err: failError }, "Failed to mark asset sync run failed");
      });
      throw error;
    }
  };

  const listAssets = (filters, pagination) => repo.listAssets(filters, pagination);
  const getAsset = (id) => repo.findAssetById(id);
  const getSyncStatus = async () => ({
    configured: isConfigured(),
    enabled: isEnabled(),
    latestRun: await repo.getLatestSyncRun()
  });

  const getFilterOptions = () => repo.getAssetFilterOptions();

  const linkAssetToUser = async (assetId, userId) => {
    const [asset, user] = await Promise.all([
      repo.findAssetById(assetId),
      userRepo.findUserById(userId)
    ]);
    if (!asset) {
      const error = new Error("Asset not found");
      error.statusCode = 404;
      throw error;
    }
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }
    return repo.setManualLink(assetId, userId);
  };

  const clearAssetLink = async (assetId) => {
    const asset = await repo.findAssetById(assetId);
    if (!asset) {
      const error = new Error("Asset not found");
      error.statusCode = 404;
      throw error;
    }
    const assignment = await resolveAssignment(asset);
    return repo.clearLink(assetId, assignment);
  };

  return {
    isConfigured,
    isEnabled,
    resolveAssignment,
    syncAssets,
    listAssets,
    getAsset,
    getSyncStatus,
    getFilterOptions,
    linkAssetToUser,
    clearAssetLink
  };
};
