import { prisma } from "../../shared/db/prisma.js";

const userSelect = {
  id: true,
  username: true,
  ldapAttributes: true
};

export const purchaseRecordInclude = {
  requester: { select: userSelect },
  requestedForUser: { select: userSelect },
  recordedBy: { select: userSelect },
  purchasedBy: { select: userSelect },
  approvedBy: { select: userSelect },
  items: { orderBy: { createdAt: "asc" } }
};

const contains = (value) => ({ contains: value });

const buildWhere = (filters = {}) => {
  const where = {
    ...(filters.recordStatus && { recordStatus: filters.recordStatus }),
    ...(filters.approvalStatus && { approvalStatus: filters.approvalStatus }),
    ...(filters.requesterId && { requesterId: filters.requesterId })
  };

  if (filters.search) {
    where.OR = [
      { reason: contains(filters.search) },
      { vendorName: contains(filters.search) },
      { requester: { username: contains(filters.search) } },
      { items: { some: { itemName: contains(filters.search) } } },
      { items: { some: { description: contains(filters.search) } } },
      { items: { some: { category: contains(filters.search) } } }
    ];
  }

  return where;
};

export const createPurchaseRecord = (data) => prisma.purchaseRecord.create({
  data,
  include: purchaseRecordInclude
});

export const getPurchaseRecordById = (id) => prisma.purchaseRecord.findUnique({
  where: { id },
  include: purchaseRecordInclude
});

export const listPurchaseRecords = async (filters = {}, pagination = {}) => {
  const { page = 1, perPage = 20 } = pagination;
  const where = buildWhere(filters);
  const skip = (page - 1) * perPage;

  const [total, data] = await prisma.$transaction([
    prisma.purchaseRecord.count({ where }),
    prisma.purchaseRecord.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: "desc" },
      include: purchaseRecordInclude
    })
  ]);

  return { data, total, page, perPage };
};

export const updatePurchaseRecordInvoice = (id, invoiceFileUrl) => prisma.purchaseRecord.update({
  where: { id },
  data: { invoiceFileUrl },
  include: purchaseRecordInclude
});

export const getPurchaseRecordByInvoiceFileUrl = (invoiceFileUrl) => prisma.purchaseRecord.findFirst({
  where: { invoiceFileUrl },
  include: purchaseRecordInclude
});

export const getPurchaseRecordItemByImageFileUrl = (imageFileUrl) => prisma.purchaseRecordItem.findFirst({
  where: { imageFileUrl },
  include: {
    purchaseRecord: {
      select: {
        requesterId: true
      }
    }
  }
});

export const updatePurchaseRecord = (id, data) => prisma.purchaseRecord.update({
  where: { id },
  data,
  include: purchaseRecordInclude
});

export const updatePurchaseRecordItemSnipeVerification = (itemId, data) => prisma.purchaseRecordItem.update({
  where: { id: itemId },
  data,
  include: { purchaseRecord: { include: purchaseRecordInclude } }
});
