import { z } from 'zod';

export const notificationSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    title: z.string(),
    message: z.string(),
    type: z.string(),
    referenceType: z.string().nullable(),
    referenceId: z.string().uuid().nullable(),
    isRead: z.boolean(),
    readAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
});

export const listNotificationsSchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    isRead: z.enum(['true', 'false']).optional()
});

export const markAsReadSchema = z.object({
    id: z.string().uuid()
});

export const notificationResponseSchema = z.object({
    data: notificationSchema
});

export const notificationListResponseSchema = z.object({
    data: z.array(notificationSchema),
    meta: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        totalPages: z.number()
    })
});

export const unreadCountResponseSchema = z.object({
    data: z.object({
        count: z.number()
    })
});

export const successResponseSchema = z.object({
    data: z.object({
        success: z.boolean()
    })
});
