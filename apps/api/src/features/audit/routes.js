import { z } from "zod";
import { requireAuthenticated } from "../../shared/auth/requireAuthenticated.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";

const querySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    action: z.string().optional(),
    actorId: z.string().uuid().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
}).refine(
    (data) => {
        if (data.startDate && data.endDate) {
            return new Date(data.startDate) <= new Date(data.endDate);
        }
        return true;
    },
    {
        message: "endDate must be after or equal to startDate",
        path: ["endDate"]
    }
);

export default async function (app, { config, userRepo, auditRepo }) {

    app.get("/audit-logs", async (request, reply) => {
        // FR4: All internal roles can view audit logs
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        const validation = querySchema.safeParse(request.query);

        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Query Parameters",
                detail: validation.error.issues[0].message
            }));
            return;
        }

        const { page, limit, action, actorId, startDate, endDate } = validation.data;

        const { logs, total } = await auditRepo.getAuditLogs({
            page,
            limit,
            actorId,
            action,
            startDate,
            endDate
        });

        // Map logs to API response format
        const mappedLogs = logs.map(log => {
            // Build actor object with user details
            const actor = log.actorUser
                ? {
                    username: log.actorUser.username,
                    role: log.actorUser.role,
                    status: log.actorUser.status
                }
                : {
                    username: "System",
                    role: null,
                    status: null
                };

            // Build human-readable target/resource name
            let target = "N/A";
            if (log.entityType && log.entityId) {
                // For user entities, we could fetch the username, but that would require additional queries
                // For now, provide a descriptive format
                target = `${log.entityType}:${log.entityId}`;
            }

            return {
                id: log.id,
                action: log.action,
                actor: actor,
                actorId: log.actorUserId,
                target: target,
                entityType: log.entityType,
                entityId: log.entityId,
                metadata: log.metadata,
                timestamp: log.createdAt
            };
        });

        return {
            data: mappedLogs,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    });
}
