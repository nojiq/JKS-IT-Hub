import { prisma } from "../../shared/db/prisma.js";

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

  return prisma.user.create({
    data: {
      username,
      role,
      status,
      ...optionalData
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
  orgSnapshot = undefined,
  orgSyncedAt = undefined,
  syncedAt = new Date()
}) => {
  const orgData = orgSnapshot === undefined
    ? {}
    : { orgSnapshot, orgSyncedAt: orgSyncedAt ?? new Date() };

  return prisma.user.upsert({
    where: { username },
    create: {
      username,
      ldapDn,
      ldapAttributes,
      ldapSyncedAt: syncedAt,
      ...orgData
    },
    update: {
      ldapDn,
      ldapAttributes,
      ldapSyncedAt: syncedAt,
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

export const listUsersFiltered = async (filters = {}, pagination = {}) => {
  const { page = 1, perPage = 20 } = pagination;
  const skip = (page - 1) * perPage;

  // Build where clause dynamically
  const where = {};

  // Text search across multiple fields
  if (filters.search) {
    where.OR = [
      { username: { contains: filters.search } },
      {
        ldapAttributes: {
          path: '$.displayName',
          string_contains: filters.search
        }
      },
      {
        ldapAttributes: {
          path: '$.cn',
          string_contains: filters.search
        }
      },
      {
        ldapAttributes: {
          path: '$.givenName',
          string_contains: filters.search
        }
      },
      {
        ldapAttributes: {
          path: '$.sn',
          string_contains: filters.search
        }
      },
      {
        ldapAttributes: {
          path: '$.mail',
          string_contains: filters.search
        }
      },
      {
        ldapAttributes: {
          path: '$.department',
          string_contains: filters.search
        }
      },
      {
        imapProfile: {
          is: {
            fullName: { contains: filters.search }
          }
        }
      }
    ];
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
