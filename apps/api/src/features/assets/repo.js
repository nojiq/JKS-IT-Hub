import { prisma } from "../../shared/db/prisma.js";

const assetSelect = {
  id: true,
  snipeAssetId: true,
  assetTag: true,
  name: true,
  serial: true,
  modelName: true,
  categoryName: true,
  statusLabel: true,
  snipeAssignedId: true,
  snipeAssignedType: true,
  snipeAssignedName: true,
  snipeAssignedUsername: true,
  snipeAssignedEmail: true,
  assignedToUserId: true,
  assignmentSource: true,
  assignmentFingerprint: true,
  lastSyncedAt: true,
  createdAt: true,
  updatedAt: true,
  assignedToUser: {
    select: {
      id: true,
      username: true,
      status: true,
      role: true,
      ldapAttributes: true,
      orgSnapshot: true,
      orgSyncedAt: true
    }
  }
};

const contains = (value) => ({ contains: value });

export const buildAssetWhere = (filters = {}) => {
  const where = {};

  if (filters.status) where.statusLabel = filters.status;
  if (filters.category) where.categoryName = filters.category;
  if (filters.assignmentSource === "auto_matched") {
    where.assignmentSource = { in: ["auto_username", "auto_email"] };
  } else if (filters.assignmentSource) {
    where.assignmentSource = filters.assignmentSource;
  }
  if (filters.assignedTo) where.assignedToUserId = filters.assignedTo;
  if (filters.linked === "true") where.assignedToUserId = { not: null };
  if (filters.linked === "false") where.assignedToUserId = null;
  if (filters.search) {
    where.OR = [
      { assetTag: contains(filters.search) },
      { name: contains(filters.search) },
      { serial: contains(filters.search) },
      { modelName: contains(filters.search) },
      { categoryName: contains(filters.search) },
      { statusLabel: contains(filters.search) },
      { snipeAssignedName: contains(filters.search) },
      { snipeAssignedUsername: contains(filters.search) },
      { snipeAssignedEmail: contains(filters.search) },
      { assignedToUser: { username: contains(filters.search) } }
    ];
  }

  return where;
};

export const listAssets = async (filters = {}, pagination = {}, tx = prisma) => {
  const page = Math.max(1, Number(pagination.page ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(pagination.perPage ?? 20)));
  const where = buildAssetWhere(filters);

  const [data, total] = await Promise.all([
    tx.asset.findMany({
      where,
      orderBy: [{ assetTag: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: assetSelect
    }),
    tx.asset.count({ where })
  ]);

  return { data, total, page, perPage };
};

export const findAssetById = (id, tx = prisma) => tx.asset.findUnique({
  where: { id },
  select: assetSelect
});

export const findAssetBySnipeAssetId = (snipeAssetId, tx = prisma) => tx.asset.findUnique({
  where: { snipeAssetId },
  select: assetSelect
});

export const upsertAsset = (data, tx = prisma) => tx.asset.upsert({
  where: { snipeAssetId: data.snipeAssetId },
  create: data,
  update: data,
  select: assetSelect
});

export const findUserByUsernameInsensitive = async (username, tx = prisma) => {
  if (!username) return null;
  const rows = await tx.$queryRaw`
    SELECT id, username, status, role, ldap_attributes AS ldapAttributes, org_snapshot AS orgSnapshot, org_synced_at AS orgSyncedAt
    FROM users
    WHERE LOWER(username) = ${username.toLowerCase()}
    LIMIT 1
  `;
  return rows[0] ?? null;
};

export const findUserByEmailInsensitive = async (email, tx = prisma) => {
  if (!email || !email.includes("@")) return null;
  const lower = email.toLowerCase();
  const rows = await tx.$queryRaw`
    SELECT id, username, status, role, ldap_attributes AS ldapAttributes, org_snapshot AS orgSnapshot, org_synced_at AS orgSyncedAt
    FROM users
    WHERE ldap_attributes IS NOT NULL
      AND (
        LOWER(JSON_UNQUOTE(JSON_EXTRACT(ldap_attributes, '$.mail'))) = ${lower}
        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(ldap_attributes, '$.userPrincipalName'))) = ${lower}
      )
    LIMIT 1
  `;
  return rows[0] ?? null;
};

export const setManualLink = (assetId, userId, tx = prisma) => tx.asset.update({
  where: { id: assetId },
  data: {
    assignedToUserId: userId,
    assignmentSource: "manual"
  },
  select: assetSelect
});

export const clearLink = (assetId, assignment, tx = prisma) => tx.asset.update({
  where: { id: assetId },
  data: {
    assignedToUserId: assignment.assignedToUserId,
    assignmentSource: assignment.assignmentSource
  },
  select: assetSelect
});

export const createSyncRun = (tx = prisma) => tx.assetSyncRun.create({
  data: { status: "started" }
});

export const completeSyncRun = (id, summary, tx = prisma) => tx.assetSyncRun.update({
  where: { id },
  data: {
    status: "completed",
    finishedAt: new Date(),
    fetchedCount: summary.fetchedCount,
    upsertedCount: summary.upsertedCount,
    matchedCount: summary.matchedCount,
    unmatchedCount: summary.unmatchedCount,
    errorMessage: null
  }
});

export const failSyncRun = (id, error, tx = prisma) => tx.assetSyncRun.update({
  where: { id },
  data: {
    status: "failed",
    finishedAt: new Date(),
    errorMessage: error?.message ?? String(error)
  }
});

export const getLatestSyncRun = (tx = prisma) => tx.assetSyncRun.findFirst({
  orderBy: { startedAt: "desc" }
});

export const getAssetFilterOptions = async (tx = prisma) => {
  const [statusRows, categoryRows] = await Promise.all([
    tx.asset.findMany({
      distinct: ["statusLabel"],
      select: { statusLabel: true },
      orderBy: { statusLabel: "asc" }
    }),
    tx.asset.findMany({
      distinct: ["categoryName"],
      select: { categoryName: true },
      orderBy: { categoryName: "asc" }
    })
  ]);

  return {
    statuses: statusRows.map((row) => row.statusLabel).filter(Boolean),
    categories: categoryRows.map((row) => row.categoryName).filter(Boolean)
  };
};
