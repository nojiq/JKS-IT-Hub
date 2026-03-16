import { emitToUsers } from '../notifications/sseHandler.js';
import { getRequestEventRecipients } from '../notifications/sseRecipients.js';
import { log } from '../../shared/logging/logger.js';

const emitToRequestRecipients = (request, type, payload) => {
    const recipients = getRequestEventRecipients(request);
    if (recipients.length === 0) return;
    emitToUsers(recipients, { type, data: payload });
};

const resolveStatusEventType = (status) => {
    if (status === 'IT_REVIEWED') return 'request.reviewed';
    if (status === 'APPROVED') return 'request.approved';
    if (status === 'REJECTED' || status === 'ALREADY_PURCHASED') return 'request.rejected';
    return null;
};

/**
 * Emit event when a new request is created
 */
export const emitRequestCreated = (request, actor) => {
    try {
        const payload = {
            requestId: request.id,
            itemName: request.itemName,
            status: request.status,
            priority: request.priority,
            createdAt: request.createdAt ?? new Date().toISOString(),
            actorId: actor?.id ?? null,
            requesterName: actor?.username || 'Unknown'
        };

        emitToRequestRecipients(request, 'request.created', payload);
    } catch (error) {
        log.error({ error: error.message, requestId: request.id }, 'Failed to emit request.created event');
    }
};

/**
 * Emit event when request details are updated
 */
export const emitRequestUpdated = (request, actor) => {
    try {
        const payload = {
            requestId: request.id,
            updatedAt: new Date().toISOString(),
            actorId: actor?.id ?? null,
            actorName: actor?.username
        };

        emitToRequestRecipients(request, 'request.updated', payload);
    } catch (error) {
        log.error({ error: error.message, requestId: request.id }, 'Failed to emit request.updated event');
    }
};

/**
 * Emit event when request status changes
 */
export const emitRequestStatusChanged = (request, previousStatus, actor) => {
    try {
        const payload = {
            requestId: request.id,
            newStatus: request.status,
            previousStatus,
            updatedAt: new Date().toISOString(),
            actorId: actor?.id ?? null,
            actorName: actor?.username,
            itemName: request.itemName
        };

        emitToRequestRecipients(request, 'request.status_changed', payload);
        const specificStatusType = resolveStatusEventType(request.status);
        if (specificStatusType) {
            emitToRequestRecipients(request, specificStatusType, payload);
        }

    } catch (error) {
        log.error({ error: error.message, requestId: request.id }, 'Failed to emit request.status_changed event');
    }
};

/**
 * Emit when IT Review is completed
 */
export const emitRequestReviewed = (request, actor) => {
    emitRequestStatusChanged(request, 'SUBMITTED', actor);
};

/**
 * Emit when Approval is completed
 */
export const emitRequestApproved = (request, actor) => {
    emitRequestStatusChanged(request, 'IT_REVIEWED', actor);
};

/**
 * Emit when Rejection occurs
 */
export const emitRequestRejected = (request, previousStatus, actor) => {
    emitRequestStatusChanged(request, previousStatus, actor);
};
