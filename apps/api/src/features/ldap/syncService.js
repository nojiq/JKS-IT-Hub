import { buildLdapSyncEvent } from "./syncEvents.js";

const normalizeValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
  if (value && typeof value === "object" && Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }
  return value;
};

const getEntryAttribute = (entry, attribute) => {
  const value = entry?.[attribute];
  if (Array.isArray(value)) {
    return value.find((item) => item !== undefined && item !== null);
  }
  return value;
};

const normalizeAttributes = (attributes, usernameAttribute) => {
  const list = Array.isArray(attributes) ? attributes : [];
  const unique = new Set(list.map((item) => item.trim()).filter(Boolean));
  if (usernameAttribute) {
    unique.add(usernameAttribute);
  }
  return [...unique];
};

const mapEntryAttributes = (entry, attributes) => {
  const mapped = {};
  for (const attribute of attributes) {
    if (entry?.[attribute] === undefined) {
      continue;
    }
    mapped[attribute] = normalizeValue(entry[attribute]);
  }
  return mapped;
};

const toIso = (value) => (value ? value.toISOString() : null);

export class LdapSyncInProgressError extends Error {
  constructor(message = "LDAP sync is already running") {
    super(message);
    this.name = "LdapSyncInProgressError";
  }
}

const toUsername = (value) => {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : String(value);
};

const calculateDiff = (oldAttrs, newAttrs) => {
  const changes = [];
  const allKeys = new Set([...Object.keys(oldAttrs || {}), ...Object.keys(newAttrs || {})]);

  for (const key of allKeys) {
    let oldVal = oldAttrs?.[key];
    let newVal = newAttrs?.[key];

    // Handle arrays: sort them to ensure order doesn't cause false diffs
    if (Array.isArray(oldVal)) {
      oldVal = [...oldVal].sort();
    }
    if (Array.isArray(newVal)) {
      newVal = [...newVal].sort();
    }

    // Simple JSON comparison for values (handles arrays/strings)
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, old: oldVal, new: newVal });
    }
  }
  return changes;
};

const getExistingUsersMap = async (userRepo, usernames) => {
  const unique = [...new Set(usernames.filter(Boolean))];
  const userMap = new Map();

  if (!unique.length) {
    return userMap;
  }

  if (userRepo?.findUsersByUsernames) {
    const existing = await userRepo.findUsersByUsernames(unique);
    for (const user of existing || []) {
      if (typeof user === "object" && user.username) {
        userMap.set(user.username, user);
      } else if (typeof user === "string") {
        // Fallback for string returns (unlikely but safe)
        userMap.set(user, { username: user });
      }
    }
    return userMap;
  }

  if (userRepo?.findUserByUsername) {
    for (const username of unique) {
      try {
        const user = await userRepo.findUserByUsername(username);
        if (user) {
          userMap.set(username, user);
        }
      } catch (e) {
        // ignore errors looking up single user
      }
    }
  }
  return userMap;
};

export const serializeSyncRun = (run) => {
  if (!run) {
    return null;
  }

  return {
    id: run.id,
    status: run.status,
    startedAt: toIso(run.startedAt),
    completedAt: toIso(run.completedAt),
    processedCount: run.processedCount ?? 0,
    createdCount: run.createdCount ?? 0,
    updatedCount: run.updatedCount ?? 0,
    skippedCount: run.skippedCount ?? 0,
    errorMessage: run.errorMessage ?? null,
    triggeredByUserId: run.triggeredByUserId
  };
};

export const createLdapSyncRunner = ({
  config,
  ldapService,
  syncRepo,
  userRepo,
  auditRepo,
  eventChannel
}) => {
  const publish = (type, run) => {
    if (!eventChannel) {
      return;
    }

    const payload = serializeSyncRun(run);
    if (!payload) {
      return;
    }

    eventChannel.publish(
      buildLdapSyncEvent({
        type,
        run: payload
      })
    );
  };

  const runSync = async (run) => {
    const syncConfig = config.ldapSync;
    const attributes = normalizeAttributes(syncConfig.attributes, syncConfig.usernameAttribute);

    if (!attributes.length) {
      throw new Error("LDAP sync attributes are not configured");
    }

    const entries = await ldapService.searchEntries({
      filter: syncConfig.filter,
      attributes,
      pageSize: syncConfig.pageSize
    });

    const processedCount = entries.length;
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const entriesWithUsernames = [];
    for (const entry of entries) {
      const usernameValue = getEntryAttribute(entry, syncConfig.usernameAttribute);
      const username = toUsername(usernameValue);
      if (!username) {
        skippedCount += 1;
        continue;
      }
      entriesWithUsernames.push({ entry, username });
    }

    const existingUsersMap = await getExistingUsersMap(
      userRepo,
      entriesWithUsernames.map(({ username }) => username)
    );

    for (const { entry, username } of entriesWithUsernames) {
      const existingUser = existingUsersMap.get(username);
      const newLdapAttributes = mapEntryAttributes(entry, attributes);

      if (existingUser) {
        updatedCount += 1;

        // Calculate diff and log audit if changed
        // Ensure we have an ID for the user before logging audit
        if (auditRepo?.createAuditLog && existingUser.id) {
          const oldLdapAttributes = existingUser.ldapAttributes || {};
          const changes = calculateDiff(oldLdapAttributes, newLdapAttributes);

          if (changes.length > 0) {
            await auditRepo.createAuditLog({
              action: "user.ldap_update",
              actorUserId: null,
              entityType: "user",
              entityId: existingUser.id,
              metadata: { changes }
            });
          }
        }
      } else {
        createdCount += 1;
      }

      await userRepo.upsertUserFromLdap({
        username,
        ldapDn: entry.dn,
        ldapAttributes: newLdapAttributes,
        syncedAt: new Date()
      });
    }

    return syncRepo.updateSyncRun(run.id, {
      status: "completed",
      completedAt: new Date(),
      processedCount,
      createdCount,
      updatedCount,
      skippedCount,
      errorMessage: null
    });
  };

  const startSync = async ({ actor, triggerType, waitForCompletion = false }) => {
    const activeRun =
      (await syncRepo.getActiveSyncRun?.()) ??
      (await syncRepo.getLatestSyncRun?.());

    if (activeRun?.status === "started") {
      throw new LdapSyncInProgressError();
    }

    const run = await syncRepo.createSyncRun({
      status: "started",
      triggeredByUserId: actor?.id ?? null // null for system
    });

    if (auditRepo?.createAuditLog) {
      await auditRepo.createAuditLog({
        action: `ldap.sync.${triggerType}`,
        actorUserId: actor?.id ?? null,
        entityType: "ldap_sync_run",
        entityId: run.id,
        metadata: {
          filter: config.ldapSync.filter,
          triggeredBy: triggerType
        }
      });
    }

    publish("started", run);

    const executionPromise = runSync(run)
      .then((completedRun) => {
        publish("completed", completedRun);
        return completedRun;
      })
      .catch(async (error) => {
        const failedRun = await syncRepo.updateSyncRun(run.id, {
          status: "failed",
          completedAt: new Date(),
          errorMessage: error?.message ?? "LDAP sync failed"
        });
        publish("failed", failedRun);
        // If we are waiting, we want to propagate the error
        if (waitForCompletion) throw error;
      });

    if (waitForCompletion) {
      return executionPromise;
    }

    // Run sync in background for manual API calls
    // We already attached handlers above, so just let it run
    return run;
  };

  const startManualSync = async ({ actor }) => {
    return startSync({ actor, triggerType: "manual", waitForCompletion: false });
  };

  const startScheduledSync = async () => {
    // Audit log specific logic for scheduled sync could go here if needed
    // We wait for completion to allow the scheduler to handle retries/errors
    return startSync({ actor: null, triggerType: "scheduled", waitForCompletion: true });
  };

  return {
    startManualSync,
    startScheduledSync
  };
};
