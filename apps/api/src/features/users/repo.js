import { prisma } from "../../shared/db/prisma.js";

export { prisma };

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
    select: {
      id: true,
      username: true,
      ldapAttributes: true
    }
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

export const updateUserRole = async (id, role) => {
  return prisma.user.update({
    where: { id },
    data: { role },
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

export const updateUserStatus = async (id, status) => {
  return prisma.user.update({
    where: { id },
    data: { status },
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
