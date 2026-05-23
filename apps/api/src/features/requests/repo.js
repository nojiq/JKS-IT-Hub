import { prisma } from "../../shared/db/prisma.js";
import { purchaseRecordInclude } from "../purchase-records/repo.js";

const firstItem = (record) => record?.items?.[0] ?? {};

const legacyStatus = (record) => {
  if (!record) return null;
  if (record.recordStatus === "REJECTED") return "REJECTED";
  if (record.approvalStatus === "APPROVED") return "APPROVED";
  if (record.approvalStatus === "REJECTED") return "REJECTED";
  if (record.approvalStatus === "SKIPPED") return "ALREADY_PURCHASED";
  if (record.approvalStatus === "PENDING") return "IT_REVIEWED";
  return "SUBMITTED";
};

const toLegacyRequest = (record) => {
  if (!record) return null;
  const item = firstItem(record);
  return {
    ...record,
    requesterId: record.requesterId,
    itemName: item.itemName ?? "",
    description: item.description ?? null,
    justification: record.reason,
    status: legacyStatus(record),
    priority: "MEDIUM",
    category: item.category ?? null,
    itReview: record.approvalNote ?? record.approvalSkipReason ?? null,
    itReviewedById: null,
    itReviewedAt: record.approvalStatus === "PENDING" ? record.updatedAt : null,
    approvedById: record.approvedById,
    approvedAt: record.approvedAt,
    rejectionReason: record.approvalStatus === "REJECTED" ? record.approvalNote : null
  };
};

const toLegacyPage = (result) => ({
  ...result,
  data: result.data.map(toLegacyRequest)
});

const statusWhere = (status) => {
  if (status === "SUBMITTED") return { recordStatus: "RECORDED", approvalStatus: "NOT_REQUIRED" };
  if (status === "IT_REVIEWED") return { recordStatus: "RECORDED", approvalStatus: "PENDING" };
  if (status === "APPROVED") return { recordStatus: "RECORDED", approvalStatus: "APPROVED" };
  if (status === "REJECTED") return { OR: [{ recordStatus: "REJECTED" }, { approvalStatus: "REJECTED" }] };
  if (status === "ALREADY_PURCHASED") return { recordStatus: "RECORDED", approvalStatus: "SKIPPED" };
  return {};
};

const buildWhere = (filters = {}, requesterId = null) => {
  const where = {
    ...(requesterId && { requesterId }),
    ...(filters.requesterId && { requesterId: filters.requesterId }),
    ...statusWhere(filters.status)
  };

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }

  if (filters.search) {
    const searchOr = [
      { reason: { contains: filters.search } },
      { requester: { username: { contains: filters.search } } },
      { items: { some: { itemName: { contains: filters.search } } } },
      { items: { some: { description: { contains: filters.search } } } },
      { items: { some: { category: { contains: filters.search } } } }
    ];
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchOr }];
      delete where.OR;
    } else {
      where.OR = searchOr;
    }
  }

  return where;
};

export async function createRequest(data) {
  const initialStatus = legacyUpdateData({ status: data.status ?? "SUBMITTED" });
  const record = await prisma.purchaseRecord.create({
    data: {
      requesterId: data.requesterId,
      reason: data.justification,
      recordedById: data.requesterId,
      recordStatus: initialStatus.recordStatus ?? "RECORDED",
      approvalStatus: initialStatus.approvalStatus ?? "NOT_REQUIRED",
      approvalNote: data.itReview ?? data.rejectionReason ?? null,
      approvedById: data.approvedById ?? null,
      approvedAt: data.approvedAt ?? null,
      items: {
        create: {
          itemName: data.itemName,
          description: data.description ?? null,
          category: data.category ?? null,
          quantity: 1
        }
      }
    },
    include: purchaseRecordInclude
  });
  return toLegacyRequest(record);
}

export async function getRequestById(id) {
  return toLegacyRequest(await prisma.purchaseRecord.findUnique({
    where: { id },
    include: purchaseRecordInclude
  }));
}

export async function getRequestsByRequesterId(requesterId, filters = {}, pagination = {}) {
  const { page = 1, perPage = 20 } = pagination;
  const where = buildWhere(filters, requesterId);
  const skip = (page - 1) * perPage;
  const [total, data] = await prisma.$transaction([
    prisma.purchaseRecord.count({ where }),
    prisma.purchaseRecord.findMany({ where, skip, take: perPage, orderBy: { createdAt: "desc" }, include: purchaseRecordInclude })
  ]);
  return toLegacyPage({ data, total, page, perPage });
}

export async function getAllRequests(filters = {}, pagination = {}) {
  const { page = 1, perPage = 20 } = pagination;
  const where = buildWhere(filters);
  const skip = (page - 1) * perPage;
  const [total, data] = await prisma.$transaction([
    prisma.purchaseRecord.count({ where }),
    prisma.purchaseRecord.findMany({ where, skip, take: perPage, orderBy: { createdAt: "desc" }, include: purchaseRecordInclude })
  ]);
  return toLegacyPage({ data, total, page, perPage });
}

export async function updateRequestInvoice(requestId, invoiceFileUrl) {
  return toLegacyRequest(await prisma.purchaseRecord.update({
    where: { id: requestId },
    data: { invoiceFileUrl },
    include: purchaseRecordInclude
  }));
}

export async function getRequestByInvoiceFileUrl(invoiceFileUrl) {
  return toLegacyRequest(await prisma.purchaseRecord.findFirst({
    where: { invoiceFileUrl },
    include: purchaseRecordInclude
  }));
}

const legacyUpdateData = (updateData) => {
  const data = {};
  if (updateData.status === "IT_REVIEWED") data.approvalStatus = "PENDING";
  if (updateData.status === "APPROVED") data.approvalStatus = "APPROVED";
  if (updateData.status === "ALREADY_PURCHASED") data.approvalStatus = "SKIPPED";
  if (updateData.status === "REJECTED") {
    data.recordStatus = "REJECTED";
    data.approvalStatus = "REJECTED";
  }
  if (updateData.itReview !== undefined) data.approvalNote = updateData.itReview;
  if (updateData.rejectionReason !== undefined) data.approvalNote = updateData.rejectionReason;
  if (updateData.approvedById !== undefined) data.approvedById = updateData.approvedById;
  if (updateData.approvedAt !== undefined) data.approvedAt = updateData.approvedAt;
  return data;
};

export async function updateRequestStatus(requestId, updateData) {
  const { expectedUpdatedAt } = updateData;
  const data = legacyUpdateData(updateData);

  if (expectedUpdatedAt) {
    const result = await prisma.purchaseRecord.updateMany({
      where: { id: requestId, updatedAt: new Date(expectedUpdatedAt) },
      data
    });
    if (result.count === 0) {
      const error = new Error("Request was modified by another action. Refresh and try again.");
      error.name = "Conflict";
      throw error;
    }
    return getRequestById(requestId);
  }

  return toLegacyRequest(await prisma.purchaseRecord.update({
    where: { id: requestId },
    data,
    include: purchaseRecordInclude
  }));
}

export async function updateRequestITReview(requestId, reviewData) {
  return updateRequestStatus(requestId, reviewData);
}

export async function approveRequest(requestId, approvedById, approvedAt = new Date(), expectedUpdatedAt = null) {
  return updateRequestStatus(requestId, {
    status: "APPROVED",
    approvedById,
    approvedAt,
    expectedUpdatedAt
  });
}
