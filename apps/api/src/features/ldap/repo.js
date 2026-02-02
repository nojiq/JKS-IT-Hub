import { prisma } from "../../shared/db/prisma.js";

export const createSyncRun = async ({ status = "started", triggeredByUserId }) => {
  return prisma.ldapSyncRun.create({
    data: {
      status,
      triggeredByUserId
    }
  });
};

export const updateSyncRun = async (id, updates) => {
  return prisma.ldapSyncRun.update({
    where: { id },
    data: updates
  });
};

export const getLatestSyncRun = async () => {
  return prisma.ldapSyncRun.findFirst({
    orderBy: { startedAt: "desc" }
  });
};

export const getActiveSyncRun = async () => {
  return prisma.ldapSyncRun.findFirst({
    where: { status: "started" },
    orderBy: { startedAt: "desc" }
  });
};
