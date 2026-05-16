import { prisma } from "../../shared/db/prisma.js";
import { deriveRoleForDepartment } from "../../shared/auth/departmentRoleAssignment.js";

export { prisma };

export const findUserByUsername = async (username) => {
  return prisma.user.findUnique({
    where: { username }
  });
};

/** Case-insensitive match on synced LDAP mail or userPrincipalName (email-style login). */
export const findUserByLdapMail = async (mail) => {
  const trimmed = mail.trim();
  if (!trimmed || !trimmed.includes("@")) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  const rows = await prisma.$queryRaw`
    SELECT
      id,
      username,
      status,
      role,
      ldap_dn AS ldapDn,
      ldap_attributes AS ldapAttributes,
      ldap_synced_at AS ldapSyncedAt,
      org_snapshot AS orgSnapshot,
      org_synced_at AS orgSyncedAt,
      created_at AS createdAt,
      updated_at AS updatedAt
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

export const findUserById = async (id) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      ldapAttributes: true,
      ldapSyncedAt: true,
      orgSnapshot: true,
      orgSyncedAt: true
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
      ldapSyncedAt: true,
      orgSnapshot: true,
      orgSyncedAt: true
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
      role: true,
      ldapAttributes: true,
      orgSnapshot: true,
      orgSyncedAt: true
    }
  });
};

export const findUsersByIds = async (ids = []) => {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) {
    return [];
  }
  return prisma.user.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      username: true,
      ldapAttributes: true,
      orgSnapshot: true,
      orgSyncedAt: true
    }
  });
};

export const createUser = async ({
  username,
  role = "requester",
  status = "active",
  ldapDn = undefined,
  ldapAttributes = undefined,
  ldapSyncedAt = undefined,
  orgSnapshot = undefined,
  orgSyncedAt = undefined
}) => {
  const optionalData = {
    ...(ldapDn !== undefined ? { ldapDn } : {}),
    ...(ldapAttributes !== undefined ? { ldapAttributes } : {}),
    ...(ldapSyncedAt !== undefined ? { ldapSyncedAt } : {}),
    ...(orgSnapshot !== undefined ? { orgSnapshot } : {}),
    ...(orgSyncedAt !== undefined ? { orgSyncedAt } : {})
  };
  const assignedRole = deriveRoleForDepartment({ currentRole: role, ldapAttributes, orgSnapshot });

  return prisma.user.create({
    data: {
      username,
      role: assignedRole,
      status,
      ...optionalData
    }
  });
};

export const findOrCreateUser = async ({
  username,
  role = "requester",
  ldapAttributes = undefined,
  orgSnapshot = undefined,
  orgSyncedAt = undefined
}) => {
  const existing = await findUserByUsername(username);
  if (existing) {
    const nextRole = deriveRoleForDepartment({
      currentRole: existing.role,
      ldapAttributes,
      orgSnapshot
    });
    if (nextRole !== existing.role) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { role: nextRole }
      });
    }
    return existing;
  }

  return createUser({ username, role, status: "active", ldapAttributes, orgSnapshot, orgSyncedAt });
};

export const upsertUserFromLdap = async ({
  username,
  ldapDn,
  ldapAttributes,
  role = undefined,
  orgSnapshot = undefined,
  orgSyncedAt = undefined,
  syncedAt = new Date()
}) => {
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { role: true }
  });
  const assignedRole = deriveRoleForDepartment({
    currentRole: existing?.role ?? role ?? "requester",
    ldapAttributes,
    orgSnapshot
  });
  const orgData = orgSnapshot === undefined
    ? {}
    : { orgSnapshot, orgSyncedAt: orgSyncedAt ?? new Date() };
  const updateRoleData = existing && assignedRole !== existing.role ? { role: assignedRole } : {};

  return prisma.user.upsert({
    where: { username },
    create: {
      username,
      role: assignedRole,
      ldapDn,
      ldapAttributes,
      ldapSyncedAt: syncedAt,
      ...orgData
    },
    update: {
      ldapDn,
      ldapAttributes,
      ldapSyncedAt: syncedAt,
      ...updateRoleData,
      ...orgData
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
      ldapSyncedAt: true,
      orgSnapshot: true,
      orgSyncedAt: true
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
      ldapSyncedAt: true,
      orgSnapshot: true,
      orgSyncedAt: true
    }
  });
};

export const updateUserOrgSnapshot = async (id, orgSnapshot) => {
  const existing = await prisma.user.findUnique({
    where: { id },
    select: {
      role: true,
      ldapAttributes: true
    }
  });
  const assignedRole = existing
    ? deriveRoleForDepartment({
        currentRole: existing.role,
        ldapAttributes: existing.ldapAttributes,
        orgSnapshot
      })
    : null;

  return prisma.user.update({
    where: { id },
    data: {
      orgSnapshot: orgSnapshot === null ? null : orgSnapshot,
      orgSyncedAt: new Date(),
      ...(existing && assignedRole !== existing.role ? { role: assignedRole } : {})
    },
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      ldapAttributes: true,
      ldapSyncedAt: true,
      orgSnapshot: true,
      orgSyncedAt: true
    }
  });
};

const LDAP_SEARCH_PATHS = [
  "$.displayName",
  "$.cn",
  "$.givenName",
  "$.sn",
  "$.mail",
  "$.department"
];

const toTitleCaseWords = (value) =>
  value.replace(/\S+/g, (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());

const buildSearchVariants = (value) => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return [];
  }

  return [...new Set([trimmed, trimmed.toLowerCase(), trimmed.toUpperCase(), toTitleCaseWords(trimmed)])];
};

const buildSearchClauses = (value) => buildSearchVariants(value).flatMap((variant) => [
  { username: { contains: variant } },
  ...LDAP_SEARCH_PATHS.map((path) => ({
    ldapAttributes: {
      path,
      string_contains: variant
    }
  })),
  {
    imapProfile: {
      is: {
        fullName: { contains: variant }
      }
    }
  }
]);

const buildUserSearchWhere = (search) => {
  const trimmed = String(search ?? "").trim();
  if (!trimmed) {
    return [];
  }

  const clauses = buildSearchClauses(trimmed);
  const tokens = [...new Set(trimmed.split(/\s+/).map((part) => part.trim()).filter(Boolean))];

  if (tokens.length > 1) {
    clauses.push({
      AND: tokens.map((token) => ({
        OR: buildSearchClauses(token)
      }))
    });
  }

  return clauses;
};

export const listUsersFiltered = async (filters = {}, pagination = {}) => {
  const { page = 1, perPage = 20 } = pagination;
  const skip = (page - 1) * perPage;

  // Build where clause dynamically
  const where = {};

  // Text search across multiple fields
  if (filters.search) {
    where.OR = buildUserSearchWhere(filters.search);
  }

  // Exact match filters
  if (filters.role) {
    where.role = filters.role;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  const [total, data] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { username: 'asc' },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        ldapAttributes: true,
        ldapSyncedAt: true,
        orgSnapshot: true,
        orgSyncedAt: true
      }
    })
  ]);

  return { data, total, page, perPage };
};
