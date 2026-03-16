import { prisma } from "../../shared/db/prisma.js";

const requestInclude = {
    requester: {
        select: {
            id: true,
            username: true,
            ldapAttributes: true
        }
    },
    itReviewedBy: {
        select: { id: true, username: true, ldapAttributes: true }
    },
    approvedBy: {
        select: { id: true, username: true, ldapAttributes: true }
    }
};

export async function createRequest(data) {
    return await prisma.itemRequest.create({
        data,
        include: {
            requester: {
                select: {
                    id: true,
                    username: true,
                    ldapAttributes: true
                }
            }
        }
    });
}

export async function getRequestById(id) {
    return await prisma.itemRequest.findUnique({
        where: { id },
        include: requestInclude
    });
}

export async function getRequestsByRequesterId(requesterId, filters = {}, pagination = {}) {
    const { page = 1, perPage = 20 } = pagination;
    const skip = (page - 1) * perPage;

    const where = {
        requesterId,
        ...(filters.status && { status: filters.status }),
        ...(filters.dateFrom && { createdAt: { gte: new Date(filters.dateFrom) } }),
        ...(filters.dateTo && { createdAt: { lte: new Date(filters.dateTo) } }),
        ...(filters.priority && { priority: filters.priority })
    };

    if (filters.search) {
        where.OR = [
            { itemName: { contains: filters.search } },
            { description: { contains: filters.search } },
            { justification: { contains: filters.search } }
        ];
    }

    const [total, data] = await prisma.$transaction([
        prisma.itemRequest.count({ where }),
        prisma.itemRequest.findMany({
            where,
            skip,
            take: perPage,
            orderBy: { createdAt: 'desc' },
            include: {
                requester: {
                    select: {
                        id: true,
                        username: true,
                        ldapAttributes: true
                    }
                }
            }
        })
    ]);

    return { data, total, page, perPage };
}

export async function getAllRequests(filters = {}, pagination = {}) {
    const { page = 1, perPage = 20 } = pagination;
    const skip = (page - 1) * perPage;

    const where = {
        ...(filters.status && { status: filters.status }),
        ...(filters.requesterId && { requesterId: filters.requesterId }),
        ...(filters.priority && { priority: filters.priority })
    };

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
        if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    // Text search across itemName, description, and requester username
    if (filters.search) {
        where.OR = [
            { itemName: { contains: filters.search } },
            { description: { contains: filters.search } },
            { requester: { username: { contains: filters.search } } }
        ];
    }

    const [total, data] = await prisma.$transaction([
        prisma.itemRequest.count({ where }),
        prisma.itemRequest.findMany({
            where,
            skip,
            take: perPage,
            orderBy: { createdAt: 'desc' },
            include: {
                requester: {
                    select: {
                        id: true,
                        username: true,
                        ldapAttributes: true
                    }
                }
            }
        })
    ]);

    return { data, total, page, perPage };
}

/**
 * Update request with invoice file URL
 * @param {string} requestId - Request ID
 * @param {string|null} invoiceFileUrl - URL to the uploaded invoice file
 * @returns {Promise<Object>} Updated request with requester info
 */
export async function updateRequestInvoice(requestId, invoiceFileUrl) {
    return await prisma.itemRequest.update({
        where: { id: requestId },
        data: { invoiceFileUrl },
        include: {
            requester: {
                select: {
                    id: true,
                    username: true,
                    ldapAttributes: true
                }
            }
        }
    });
}

export async function getRequestByInvoiceFileUrl(invoiceFileUrl) {
    return prisma.itemRequest.findFirst({
        where: { invoiceFileUrl },
        include: {
            requester: {
                select: {
                    id: true,
                    username: true,
                    ldapAttributes: true
                }
            }
        }
    });
}

export async function updateRequestStatus(requestId, updateData) {
    const { expectedUpdatedAt, ...data } = updateData;

    if (!expectedUpdatedAt) {
        return await prisma.itemRequest.update({
            where: { id: requestId },
            data,
            include: requestInclude
        });
    }

    const result = await prisma.itemRequest.updateMany({
        where: {
            id: requestId,
            updatedAt: new Date(expectedUpdatedAt)
        },
        data
    });

    if (result.count === 0) {
        const error = new Error("Request was modified by another action. Refresh and try again.");
        error.name = "Conflict";
        throw error;
    }

    return await prisma.itemRequest.findUnique({
        where: { id: requestId },
        include: requestInclude
    });
}

export async function updateRequestITReview(requestId, reviewData) {
    return await updateRequestStatus(requestId, reviewData);
}

export async function approveRequest(requestId, approvedById, approvedAt = new Date(), expectedUpdatedAt = null) {
    return await updateRequestStatus(requestId, {
        status: "APPROVED",
        approvedById,
        approvedAt,
        expectedUpdatedAt
    });
}
