import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client.js";

const getDatabaseOptions = () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to initialize Prisma Client");
  }

  const parsed = new URL(url);

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\/+/, ""),
    connectionLimit: 5
  };
};

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(getDatabaseOptions())
});

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
