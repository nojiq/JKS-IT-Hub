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

export const findUserByUsername = async (username) => {
  return prisma.user.findUnique({
    where: { username }
  });
};

export const findUserById = async (id) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      ldapAttributes: true,
      ldapSyncedAt: true
    }
  });
};

export const listUsers = async () => {
  return prisma.user.findMany({
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      ldapAttributes: true,
      ldapSyncedAt: true
    }
  });
};

export const findUsersByUsernames = async (usernames = []) => {
  const unique = [...new Set(usernames.filter(Boolean))];
  if (!unique.length) {
    return [];
  }
  return prisma.user.findMany({
    where: { username: { in: unique } },
    select: { username: true }
  });
};

export const createUser = async ({ username, role = "requester", status = "active" }) => {
  return prisma.user.create({
    data: {
      username,
      role,
      status
    }
  });
};

export const findOrCreateUser = async ({ username, role = "requester" }) => {
  const existing = await findUserByUsername(username);
  if (existing) {
    return existing;
  }

  return createUser({ username, role, status: "active" });
};

export const upsertUserFromLdap = async ({
  username,
  ldapDn,
  ldapAttributes,
  syncedAt = new Date()
}) => {
  return prisma.user.upsert({
    where: { username },
    create: {
      username,
      ldapDn,
      ldapAttributes,
      ldapSyncedAt: syncedAt
    },
    update: {
      ldapDn,
      ldapAttributes,
      ldapSyncedAt: syncedAt
    }
  });
};

export const isUserDisabled = (user) => user?.status === "disabled";
