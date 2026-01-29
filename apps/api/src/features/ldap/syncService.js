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

const getExistingUsernames = async (userRepo, usernames) => {
  const unique = [...new Set(usernames.filter(Boolean))];
  if (!unique.length) {
    return new Set();
  }

  if (userRepo?.findUsersByUsernames) {
    const existing = await userRepo.findUsersByUsernames(unique);
    return new Set(
      (existing ?? []).map((item) => (typeof item === "string" ? item : item.username)).filter(Boolean)
    );
  }

  const existing = new Set();
  if (userRepo?.findUserByUsername) {
    for (const username of unique) {
      const user = await userRepo.findUserByUsername(username);
      if (user?.username) {
        existing.add(user.username);
      } else if (user) {
        existing.add(username);
      }
    }
  }
  return existing;
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

    const existingUsernames = await getExistingUsernames(
      userRepo,
      entriesWithUsernames.map(({ username }) => username)
    );

    for (const { entry, username } of entriesWithUsernames) {
      if (existingUsernames.has(username)) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }

      await userRepo.upsertUserFromLdap({
        username,
        ldapDn: entry.dn,
        ldapAttributes: mapEntryAttributes(entry, attributes),
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

  const startManualSync = async ({ actor }) => {
    const activeRun =
      (await syncRepo.getActiveSyncRun?.()) ??
      (await syncRepo.getLatestSyncRun?.());
    if (activeRun?.status === "started") {
      throw new LdapSyncInProgressError();
    }

    const run = await syncRepo.createSyncRun({
      status: "started",
      triggeredByUserId: actor.id
    });

    if (auditRepo?.createAuditLog) {
      await auditRepo.createAuditLog({
        action: "ldap.sync.manual",
        actorUserId: actor.id,
        entityType: "ldap_sync_run",
        entityId: run.id,
        metadata: {
          filter: config.ldapSync.filter
        }
      });
    }

    publish("started", run);

    setImmediate(() => {
      runSync(run)
        .then((completedRun) => {
          publish("completed", completedRun);
        })
        .catch(async (error) => {
          const failedRun = await syncRepo.updateSyncRun(run.id, {
            status: "failed",
            completedAt: new Date(),
            errorMessage: error?.message ?? "LDAP sync failed"
          });
          publish("failed", failedRun);
        });
    });

    return run;
  };

  return {
    startManualSync
  };
};
