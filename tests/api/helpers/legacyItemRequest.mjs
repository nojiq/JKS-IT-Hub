import { purchaseRecordInclude } from "../../../apps/api/src/features/purchase-records/repo.js";

const statusToRecordData = (status) => {
    if (status === "IT_REVIEWED") return { recordStatus: "RECORDED", approvalStatus: "PENDING" };
    if (status === "APPROVED") return { recordStatus: "RECORDED", approvalStatus: "APPROVED" };
    if (status === "ALREADY_PURCHASED") return { recordStatus: "RECORDED", approvalStatus: "SKIPPED" };
    if (status === "REJECTED") return { recordStatus: "REJECTED", approvalStatus: "REJECTED" };
    return { recordStatus: "RECORDED", approvalStatus: "NOT_REQUIRED" };
};

const recordToStatus = (record) => {
    if (record.recordStatus === "REJECTED") return "REJECTED";
    if (record.approvalStatus === "APPROVED") return "APPROVED";
    if (record.approvalStatus === "REJECTED") return "REJECTED";
    if (record.approvalStatus === "SKIPPED") return "ALREADY_PURCHASED";
    if (record.approvalStatus === "PENDING") return "IT_REVIEWED";
    return "SUBMITTED";
};

const mapWhere = (where = {}) => {
    const mapped = { ...where };
    if (where.status) {
        Object.assign(mapped, statusToRecordData(where.status));
        delete mapped.status;
    }
    return mapped;
};

const mapData = (data = {}) => {
    const mapped = {};
    if ("requesterId" in data) mapped.requesterId = data.requesterId;
    if ("invoiceFileUrl" in data) mapped.invoiceFileUrl = data.invoiceFileUrl;
    if ("approvedById" in data) mapped.approvedById = data.approvedById;
    if ("approvedAt" in data) mapped.approvedAt = data.approvedAt;
    if ("status" in data) Object.assign(mapped, statusToRecordData(data.status));
    if ("justification" in data) mapped.reason = data.justification;
    if ("itReview" in data) mapped.approvalNote = data.itReview;
    if ("rejectionReason" in data) mapped.approvalNote = data.rejectionReason;
    if (data.status === "SUBMITTED") {
        mapped.approvalNote = null;
        mapped.approvedById = null;
        mapped.approvedAt = null;
    }
    return mapped;
};

const toLegacy = (record) => {
    if (!record) return null;
    const firstItem = record.items?.[0] ?? {};
    return {
        ...record,
        itemName: firstItem.itemName ?? "",
        description: firstItem.description ?? null,
        justification: record.reason,
        status: recordToStatus(record),
        priority: "MEDIUM",
        category: firstItem.category ?? null,
        itReview: record.approvalNote ?? record.approvalSkipReason ?? null,
        itReviewedById: null,
        itReviewedAt: record.approvalStatus === "PENDING" ? record.updatedAt : null,
        approvedById: record.approvedById,
        approvedAt: record.approvedAt,
        rejectionReason: record.approvalStatus === "REJECTED" ? record.approvalNote : null
    };
};

export const createLegacyItemRequest = (prisma) => ({
    async create({ data }) {
        const record = await prisma.purchaseRecord.create({
            data: {
                requesterId: data.requesterId,
                reason: data.justification ?? data.reason ?? "",
                invoiceFileUrl: data.invoiceFileUrl ?? null,
                recordedById: data.recordedById ?? data.requesterId,
                ...statusToRecordData(data.status),
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
        return toLegacy(record);
    },
    async update({ where, data }) {
        const record = await prisma.purchaseRecord.update({
            where,
            data: mapData(data),
            include: purchaseRecordInclude
        });
        return toLegacy(record);
    },
    async delete(args) {
        return prisma.purchaseRecord.delete(args);
    },
    async deleteMany(args = {}) {
        return prisma.purchaseRecord.deleteMany({ ...args, where: mapWhere(args.where) });
    },
    async count(args = {}) {
        return prisma.purchaseRecord.count({ ...args, where: mapWhere(args.where) });
    },
    async findUnique(args) {
        if (args.select) return prisma.purchaseRecord.findUnique(args);
        return toLegacy(await prisma.purchaseRecord.findUnique({ ...args, include: purchaseRecordInclude }));
    },
    async findMany(args = {}) {
        if (args.select) {
            return prisma.purchaseRecord.findMany({ ...args, where: mapWhere(args.where) });
        }
        const records = await prisma.purchaseRecord.findMany({
            ...args,
            where: mapWhere(args.where),
            include: purchaseRecordInclude
        });
        return records.map(toLegacy);
    }
});
