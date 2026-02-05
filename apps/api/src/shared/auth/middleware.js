import { createProblemDetails, sendProblem } from "../errors/problemDetails.js";

const IT_ONLY_ROLES = new Set(["it", "head_it"]);

export const requireItRole = async (
    request,
    reply,
    { auditRepo, forbiddenDetail = "IT role required to access IMAP credentials" } = {}
) => {
    const user = request.user; // Assumes user is already authenticated and attached to request

    if (!user) {
        sendProblem(
            reply,
            createProblemDetails({
                status: 401, // Or 403 if we consider "no user" as insufficient permissions but usually 401
                title: "Unauthorized",
                detail: "User not authenticated."
            })
        );
        return false;
    }

    if (!IT_ONLY_ROLES.has(user.role)) {
        // Log access denied if auditRepo is provided
        if (auditRepo) {
            // Best effort to get target context. 
            // Task 6 requires logging "Target user (whose IMAP credentials were requested)".
            // Usually accessing /users/:id/credentials, so target is params.id
            const targetUserId = request.params?.id || request.body?.targetUserId;

            await auditRepo.create({
                action: 'credential.imap.access.denied',
                actorUserId: user.id,
                metadata: {
                    reason: 'insufficient_permissions',
                    requiredRole: 'it',
                    actualRole: user.role,
                    targetUserId: targetUserId
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
                extensions: { // Custom extensions matching RFC 9457 structured checks if supported by createProblemDetails
                    requiredRole: 'it',
                    actualRole: user.role
                }
            })
        );
        return false;
    }

    return true;
};
