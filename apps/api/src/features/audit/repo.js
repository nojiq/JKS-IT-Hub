import { prisma } from "../../shared/db/prisma.js";

export { prisma };

export const createAuditLog = async ({
  action,
  actorUserId,
  entityType,
  entityId,
  metadata
}, tx = prisma) => {
  return tx.auditLog.create({
    data: {
      action,
      actorUserId,
      entityType,
      entityId,
      metadata
    }
  });
};

export const findAuditLogsByEntity = async (entityId, entityType, { actions = [], limit = 100 } = {}) => {
  const where = {
    entityId,
    entityType
  };

  if (actions && actions.length > 0) {
    where.action = { in: actions };
  }

  return prisma.auditLog.findMany({
    where,
    take: limit,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      actorUser: {
        select: {
          username: true,
          role: true,
          status: true
        }
      }
    }
  });
};

export const getAuditLogs = async ({
  page = 1,
  limit = 50,
  actorId,
  action,
  startDate,
  endDate
}) => {
  const where = {};

  if (actorId) {
    where.actorUserId = actorId;
  }

  if (action) {
    where.action = action;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        createdAt: "desc"
      },
      include: {
        actorUser: {
          select: {
            username: true,
            role: true,
            status: true
          }
        }
      }
    })
  ]);

  return { logs, total };
};
