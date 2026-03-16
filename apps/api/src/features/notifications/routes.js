
import { requireAuthenticated } from "../../shared/auth/requireAuthenticated.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";
import * as inAppRepo from './inAppRepo.js';
import { listNotificationsSchema, markAsReadSchema } from './schema.js';
import { addClient } from './sseHandler.js';

export default async function (app, { config, userRepo }) {

    const handleError = (reply, error) => {
        app.log.error({ error: error.message, stack: error.stack }, 'Notification API Error');
        return sendProblem(reply, createProblemDetails({ status: 500, title: "Internal Server Error", detail: error.message }));
    };



    // List Current User's Notifications
    app.get("/", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // Manual validation
        const validation = listNotificationsSchema.safeParse(request.query);

        if (!validation.success) {
            return sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Validation Error",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
        }

        try {
            const { page, limit, isRead } = validation.data;

            // Convert 'true'/'false' strings from enum to booleans if present
            // Zod coerce might have handled numbers but isRead is string enum in schema?
            // Let's check schema details. 
            // Existing schema: isRead: z.enum(['true', 'false']).optional()

            let isReadBool = null;
            if (isRead === 'true') isReadBool = true;
            if (isRead === 'false') isReadBool = false;

            const result = await inAppRepo.getNotificationsByUserId(actor.id, {
                page,
                limit,
                isRead: isReadBool
            });

            return { data: result.data, meta: result.meta };
        } catch (err) {
            return handleError(reply, err);
        }
    });

    // Get Unread Count
    app.get("/unread-count", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const count = await inAppRepo.getUnreadCount(actor.id);
            return { data: { count } };
        } catch (err) {
            return handleError(reply, err);
        }
    });

    // Mark All as Read
    app.put("/read-all", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            await inAppRepo.markAllAsRead(actor.id);
            return { data: { success: true } };
        } catch (err) {
            return handleError(reply, err);
        }
    });

    // Mark Single as Read
    app.put("/:id/read", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        const validation = markAsReadSchema.safeParse(request.params);
        if (!validation.success) {
            return sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Validation Error",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
        }

        const { id } = validation.data;

        try {
            const notification = await inAppRepo.getNotificationById(id);

            if (!notification) {
                return sendProblem(reply, createProblemDetails({
                    status: 404,
                    title: "Not Found",
                    detail: "Notification not found"
                }));
            }

            if (notification.userId !== actor.id) {
                return sendProblem(reply, createProblemDetails({
                    status: 403,
                    title: "Forbidden",
                    detail: "Cannot mark another user's notification as read"
                }));
            }

            await inAppRepo.markAsRead(id, actor.id);
            return { data: { success: true } };
        } catch (err) {
            return handleError(reply, err);
        }
    });
}
