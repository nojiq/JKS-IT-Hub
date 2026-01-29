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

export const createAuditLog = async ({
  action,
  actorUserId,
  entityType,
  entityId,
  metadata
}) => {
  return prisma.auditLog.create({
    data: {
      action,
      actorUserId,
      entityType,
      entityId,
      metadata
    }
  });
};
