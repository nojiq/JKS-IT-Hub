import { prisma } from "../../shared/db/prisma.js";

const START_LOCK_NAME = "ldap_sync_start_lock";
const START_LOCK_TIMEOUT_SECONDS = 5;

export const createSyncRepoClient = (client = prisma) => ({
  createSyncRun: async ({ status = "started", triggeredByUserId }) => {
    return client.ldapSyncRun.create({
      data: {
        status,
        triggeredByUserId
      }
    });
  },

  updateSyncRun: async (id, updates) => {
    return client.ldapSyncRun.update({
      where: { id },
      data: updates
    });
  },

  getLatestSyncRun: async () => {
    return client.ldapSyncRun.findFirst({
      orderBy: { startedAt: "desc" }
    });
  },

  getActiveSyncRun: async () => {
    return client.ldapSyncRun.findFirst({
      where: { status: "started" },
      orderBy: { startedAt: "desc" }
    });
  },

  listStartedSyncRuns: async () => {
    return client.ldapSyncRun.findMany({
      where: { status: "started" },
      orderBy: { startedAt: "desc" }
    });
  }
});

export const createSyncRun = async (data) => {
  return createSyncRepoClient().createSyncRun(data);
};

export const updateSyncRun = async (id, updates) => {
  return createSyncRepoClient().updateSyncRun(id, updates);
};

export const getLatestSyncRun = async () => {
  return createSyncRepoClient().getLatestSyncRun();
};

export const getActiveSyncRun = async () => {
  return createSyncRepoClient().getActiveSyncRun();
};

export const listStartedSyncRuns = async () => {
  return createSyncRepoClient().listStartedSyncRuns();
};

export const withSyncStartLock = async (callback) => {
  return prisma.$transaction(async (tx) => {
    const result = await tx.$queryRawUnsafe(
      `SELECT GET_LOCK('${START_LOCK_NAME}', ${START_LOCK_TIMEOUT_SECONDS}) AS acquired`
    );
    const acquired = Array.isArray(result) ? Number(result[0]?.acquired ?? 0) : 0;

    if (acquired !== 1) {
      throw new Error("Failed to acquire LDAP sync start lock");
    }

    try {
      return await callback(createSyncRepoClient(tx));
    } finally {
      await tx.$queryRawUnsafe(`SELECT RELEASE_LOCK('${START_LOCK_NAME}') AS released`);
    }
  });
};
