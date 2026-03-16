import { prisma } from '../../shared/db/prisma.js';

/**
 * Create a single in-app notification
 */
export const createNotification = async (data) => {
    return prisma.inAppNotification.create({
        data: {
            userId: data.userId,
            title: data.title,
            message: data.message,
            type: data.type,
            referenceType: data.referenceType || null,
            referenceId: data.referenceId || null,
            isRead: false
        }
    });
};

/**
 * Create notifications for multiple users
 */
export const createBulkNotifications = async (notifications) => {
    return Promise.all(notifications.map(n =>
        prisma.inAppNotification.create({
            data: {
                userId: n.userId,
                title: n.title,
                message: n.message,
                type: n.type,
                referenceType: n.referenceType || null,
                referenceId: n.referenceId || null,
                isRead: false
            }
        })
    ));
};

/**
 * Get notifications for a user with pagination
 */
export const getNotificationsByUserId = async (userId, { page = 1, limit = 20, isRead = null } = {}) => {
    const where = { userId };
    if (isRead !== null) {
        where.isRead = isRead;
    }

    const [notifications, total] = await Promise.all([
        prisma.inAppNotification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        }),
        prisma.inAppNotification.count({ where })
    ]);

    return {
        data: notifications,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async (userId) => {
    return prisma.inAppNotification.count({
        where: {
            userId,
            isRead: false
        }
    });
};

/**
 * Mark single notification as read
 */
export const markAsRead = async (notificationId, userId) => {
    return prisma.inAppNotification.updateMany({
        where: {
            id: notificationId,
            userId // Ensure user owns the notification
        },
        data: {
            isRead: true,
            readAt: new Date()
        }
    });
};

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = async (userId) => {
    return prisma.inAppNotification.updateMany({
        where: {
            userId,
            isRead: false
        },
        data: {
            isRead: true,
            readAt: new Date()
        }
    });
};

/**
 * Get notification by ID
 */
export const getNotificationById = async (id) => {
    return prisma.inAppNotification.findUnique({
        where: { id }
    });
};
