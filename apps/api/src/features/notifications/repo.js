
import { prisma } from '../../shared/db/prisma.js';

/**
 * proper casing for inputs
 */

export const createNotificationRecord = async ({
    recipientEmail,
    recipientUserId,
    subject,
    templateType,
    referenceType,
    referenceId
}) => {
    return prisma.emailNotification.create({
        data: {
            recipientEmail,
            recipientUserId,
            subject,
            templateType,
            referenceType,
            referenceId,
            status: 'pending'
        }
    });
};

export const updateNotificationStatus = async (id, status, errorMessage) => {
    return prisma.emailNotification.update({
        where: { id },
        data: {
            status,
            errorMessage,
            sentAt: status === 'sent' ? new Date() : undefined
        }
    });
};

// ... existing code ...

export const getNotificationsForRequest = async (requestId) => {
    return prisma.emailNotification.findMany({
        where: {
            referenceType: 'item_request',
            referenceId: requestId
        },
        orderBy: { createdAt: 'desc' }
    });
};

export const getNotificationsByRecipient = async (recipientUserId, limit = 20) => {
    return prisma.emailNotification.findMany({
        where: { recipientUserId },
        orderBy: { createdAt: 'desc' },
        take: limit
    });
};

export const getAllNotifications = async (filters = {}, pagination = {}) => {
    const { page = 1, perPage = 20 } = pagination;
    const skip = (page - 1) * perPage;

    const where = {
        ...(filters.recipientEmail && { recipientEmail: { contains: filters.recipientEmail } }),
        ...(filters.status && { status: filters.status }),
        ...(filters.referenceId && { referenceId: filters.referenceId })
    };

    const [total, data] = await prisma.$transaction([
        prisma.emailNotification.count({ where }),
        prisma.emailNotification.findMany({
            where,
            skip,
            take: perPage,
            orderBy: { createdAt: 'desc' },
            include: {
                recipientUser: {
                    select: { id: true, username: true }
                }
            }
        })
    ]);

    return { data, total, page, perPage };
};
