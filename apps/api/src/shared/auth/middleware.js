import { createProblemDetails, sendProblem } from "../errors/problemDetails.js";

const IMAP_ACCESS_ROLES = new Set(["it", "admin", "head_it"]);

export const requireItRole = async (
    request,
    reply,
    {
        auditRepo,
        forbiddenDetail = "Privileged role required to access IMAP credentials",
        requiredRoleLabel = "it|admin|head_it",
        targetUserId,
        targetCredentialId
    } = {}
) => {
    const user = request.user;

    if (!user) {
        sendProblem(
            reply,
            createProblemDetails({
                status: 401,
                title: "Unauthorized",
                detail: "User not authenticated."
            })
        );
        return false;
    }

    if (!IMAP_ACCESS_ROLES.has(user.role)) {
        const resolvedTargetUserId = targetUserId || request.params?.userId || request.params?.id || request.body?.targetUserId;
        const resolvedEntityId = targetCredentialId || request.params?.id || resolvedTargetUserId;

        if (auditRepo?.createAuditLog) {
            await auditRepo.createAuditLog({
                action: 'credential.imap.access.denied',
                actorUserId: user.id,
                entityType: 'user_credential',
                entityId: resolvedEntityId,
                metadata: {
                    reason: 'insufficient_permissions',
                    requiredRole: requiredRoleLabel,
                    actualRole: user.role,
                    targetUserId: resolvedTargetUserId
                }
            });
        }

        sendProblem(
            reply,
            createProblemDetails({
                status: 403,
                title: "Insufficient Permissions",
                detail: forbiddenDetail,
                type: '/problems/insufficient-permissions',
                requiredRole: requiredRoleLabel,
                actualRole: user.role
            })
        );
        return false;
    }

    return true;
};
