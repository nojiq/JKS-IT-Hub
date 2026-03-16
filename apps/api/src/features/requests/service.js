import * as repo from './repo.js';
import { createAuditLog } from '../audit/repo.js'; // Fallback as shared/audit/logger.js missing
import { hasItRole, hasAdminRole } from '../../shared/auth/rbac.js';
import {
    notifyNewRequest,
    notifyITReviewComplete,
    notifyApprovalComplete,
    notifyNewRequestInApp,
    notifyITReviewCompleteInApp,
    notifyApprovalCompleteInApp
} from '../notifications/service.js';
import {
    emitRequestCreated,
    emitRequestStatusChanged,
    emitRequestUpdated
} from './events.js';

async function ensureNotSelfReview(existingRequest, actorUser, requestId, attemptedAction) {
    if (existingRequest.requesterId !== actorUser.id) {
        return;
    }

    await createAuditLog({
        action: 'workflow_violation_blocked',
        actorUserId: actorUser.id,
        entityType: 'ItemRequest',
        entityId: requestId,
        metadata: {
            attemptedAction,
            currentStatus: existingRequest.status,
            reason: 'self_review_blocked'
        }
    });

    const error = new Error("Cannot review your own request");
    error.name = 'Forbidden';
    throw error;
}

export async function submitRequest(data, actorUser) {
    if (actorUser.status === 'disabled') {
        const error = new Error("Cannot submit requests with a disabled account");
        error.name = 'Forbidden';
        throw error;
    }

    const request = await repo.createRequest({
        requesterId: actorUser.id,
        itemName: data.itemName,
        description: data.description,
        justification: data.justification,
        priority: data.priority,
        category: data.category,
        status: 'SUBMITTED'
    });

    try {
        await createAuditLog({
            action: 'request_created',
            actorUserId: actorUser.id,
            entityType: 'ItemRequest',
            entityId: request.id,
            metadata: { itemName: request.itemName }
        });
    } catch (err) {
        console.error("Failed to default audit log", err);
    }

    notifyNewRequest(request, actorUser).catch(err =>
        console.error('Failed to send notification', err)
    );
    notifyNewRequestInApp(request, actorUser).catch(err =>
        console.error('Failed to send in-app notification', err)
    );
    emitRequestCreated(request, actorUser);

    return request;
}

export async function getMyRequests(actorUser, filters = {}, pagination = {}) {
    return repo.getRequestsByRequesterId(actorUser.id, filters, pagination);
}

export async function getAllRequests(filters = {}, pagination = {}, actorUser) {
    // Only IT/Admin/Head can view all
    if (!hasItRole(actorUser) && !hasAdminRole(actorUser)) { // Check both groups just in case
        const error = new Error("Unauthorized access");
        error.name = 'Forbidden';
        throw error;
    }
    return repo.getAllRequests(filters, pagination);
}

export async function getRequestDetails(requestId, actorUser) {
    const request = await repo.getRequestById(requestId);

    if (!request) {
        return null;
    }

    // RBAC: If not requester, must be IT/Admin/Head
    if (request.requesterId !== actorUser.id) {
        const isItOrAdmin = hasItRole(actorUser) || hasAdminRole(actorUser);
        if (!isItOrAdmin) {
            const error = new Error("You do not have permission to view this request");
            error.name = 'Forbidden';
            throw error;
        }
    }
    return request;
}

import { validateInvoiceFile } from '../../shared/uploads/validation.js';
import { saveFile, generateFileName, deleteFile, ensureUploadDir } from '../../shared/uploads/storage.js';

/**
 * Upload an invoice file to an existing request
 * @param {string} requestId - Request ID
 * @param {Object} file - File object with filename, mimetype, size, buffer
 * @param {Object} actorUser - Acting user
 * @returns {Promise<Object>} Updated request
 */
export async function uploadInvoiceToRequest(requestId, file, actorUser) {
    // Get existing request
    const existingRequest = await repo.getRequestById(requestId);

    if (!existingRequest) {
        const error = new Error("Request not found");
        error.name = "NotFound";
        throw error;
    }

    // RBAC: Only request owner can upload invoice
    if (existingRequest.requesterId !== actorUser.id) {
        const error = new Error("You can only upload invoices to your own requests");
        error.name = "Forbidden";
        throw error;
    }

    // Validate file
    const validationErrors = validateInvoiceFile(file);
    if (validationErrors.length > 0) {
        const error = new Error(validationErrors[0].message);
        error.name = "ValidationError";
        error.errors = validationErrors;
        throw error;
    }

    // Ensure upload directory exists
    await ensureUploadDir();
    const previousInvoiceUrl = existingRequest.invoiceFileUrl || null;
    const oldFileName = previousInvoiceUrl ? previousInvoiceUrl.split('/').pop() : null;
    const fileName = generateFileName(file.filename);
    const invoiceFileUrl = `/api/v1/uploads/${fileName}`;

    let updatedRequest = null;

    try {
        // Save new file first to ensure the DB never points to a missing file.
        await saveFile(file.buffer, fileName);
        updatedRequest = await repo.updateRequestInvoice(requestId, invoiceFileUrl);

        // Sensitive action: audit log creation is mandatory.
        await createAuditLog({
            action: 'invoice_uploaded',
            actorUserId: actorUser.id,
            entityType: 'ItemRequest',
            entityId: requestId,
            metadata: {
                fileName: file.filename,
                fileSize: file.size,
                fileType: file.mimetype,
                invoiceUrl: invoiceFileUrl
            }
        });

        // Remove old file only after the new file + DB + audit are successful.
        if (oldFileName) {
            await deleteFile(oldFileName);
        }

        emitRequestUpdated(updatedRequest, actorUser);
        return updatedRequest;
    } catch (err) {
        // Best-effort rollback on failures after write begins.
        try {
            await deleteFile(fileName);
        } catch (cleanupErr) {
            console.error("Failed to cleanup uploaded file after invoice upload failure", cleanupErr);
        }

        if (updatedRequest) {
            try {
                await repo.updateRequestInvoice(requestId, previousInvoiceUrl);
            } catch (rollbackErr) {
                console.error("Failed to rollback invoice URL after upload failure", rollbackErr);
            }
        }

        throw err;
    }
}

export async function itReviewRequest(requestId, reviewData, actorUser) {
    // Get existing request first for self-review check
    const existingRequest = await repo.getRequestById(requestId);
    if (!existingRequest) {
        const error = new Error("Request not found");
        error.name = 'NotFound';
        throw error;
    }

    // SELF-REVIEW CHECK: Check this BEFORE RBAC for better error message
    await ensureNotSelfReview(existingRequest, actorUser, requestId, 'it_review');

    // RBAC: Only IT/Admin/Head can review (after self-review check)
    if (!hasItRole(actorUser) && !hasAdminRole(actorUser)) {
        const error = new Error("Only IT staff can review requests");
        error.name = 'Forbidden';
        throw error;
    }

    // Validate status transition
    if (existingRequest.status !== 'SUBMITTED') {
        const error = new Error(`Cannot review request in status: ${existingRequest.status}`);
        error.name = 'ValidationError';
        throw error;
    }

    // Update request
    const updatedRequest = await repo.updateRequestITReview(requestId, {
        status: 'IT_REVIEWED',
        itReview: reviewData.itReview || null,
        itReviewedById: actorUser.id,
        itReviewedAt: new Date(),
        expectedUpdatedAt: existingRequest.updatedAt
    });

    // Audit log
    await createAuditLog({
        action: 'request_it_reviewed',
        actorUserId: actorUser.id,
        entityType: 'ItemRequest',
        entityId: requestId,
        metadata: {
            previousStatus: 'SUBMITTED',
            newStatus: 'IT_REVIEWED',
            hasReviewNotes: !!reviewData.itReview
        }
    });

    notifyITReviewComplete(updatedRequest, actorUser, 'reviewed').catch(err =>
        console.error('Failed to send notification', err)
    );
    notifyITReviewCompleteInApp(updatedRequest, actorUser, 'reviewed').catch(err =>
        console.error('Failed to send in-app notification', err)
    );
    emitRequestStatusChanged(updatedRequest, 'SUBMITTED', actorUser);

    return updatedRequest;
}

export async function markAlreadyPurchased(requestId, reason, actorUser) {
    // RBAC check
    if (!hasItRole(actorUser) && !hasAdminRole(actorUser)) {
        const error = new Error("Only IT staff can mark requests as already purchased");
        error.name = 'Forbidden';
        throw error;
    }

    const existingRequest = await repo.getRequestById(requestId);
    if (!existingRequest) {
        const error = new Error("Request not found");
        error.name = 'NotFound';
        throw error;
    }

    await ensureNotSelfReview(existingRequest, actorUser, requestId, 'mark_already_purchased');

    if (existingRequest.status !== 'SUBMITTED') {
        const error = new Error(`Cannot mark as already purchased from status: ${existingRequest.status}`);
        error.name = 'ValidationError';
        throw error;
    }

    const updatedRequest = await repo.updateRequestStatus(requestId, {
        status: 'ALREADY_PURCHASED',
        itReview: reason, // Store the reason in itReview field
        itReviewedById: actorUser.id,
        itReviewedAt: new Date(),
        expectedUpdatedAt: existingRequest.updatedAt
    });

    await createAuditLog({
        action: 'request_marked_already_purchased',
        actorUserId: actorUser.id,
        entityType: 'ItemRequest',
        entityId: requestId,
        metadata: {
            previousStatus: 'SUBMITTED',
            newStatus: 'ALREADY_PURCHASED',
            reason
        }
    });

    notifyITReviewComplete(updatedRequest, actorUser, 'already_purchased').catch(err =>
        console.error('Failed to send notification', err)
    );
    notifyITReviewCompleteInApp(updatedRequest, actorUser, 'already_purchased').catch(err =>
        console.error('Failed to send in-app notification', err)
    );
    emitRequestStatusChanged(updatedRequest, 'SUBMITTED', actorUser);

    return updatedRequest;
}

export async function rejectRequest(requestId, rejectionReason, actorUser) {
    // RBAC check
    if (!hasItRole(actorUser) && !hasAdminRole(actorUser)) {
        const error = new Error("Only IT staff can reject requests");
        error.name = 'Forbidden';
        throw error;
    }

    const existingRequest = await repo.getRequestById(requestId);
    if (!existingRequest) {
        const error = new Error("Request not found");
        error.name = 'NotFound';
        throw error;
    }

    await ensureNotSelfReview(existingRequest, actorUser, requestId, 'reject_request');

    if (existingRequest.status !== 'SUBMITTED') {
        const error = new Error(`Cannot reject request from status: ${existingRequest.status}`);
        error.name = 'ValidationError';
        throw error;
    }

    const updateData = {
        status: 'REJECTED',
        rejectionReason,
        itReviewedById: actorUser.id,
        itReviewedAt: new Date(),
        expectedUpdatedAt: existingRequest.updatedAt
    };

    const updatedRequest = await repo.updateRequestStatus(requestId, updateData);

    await createAuditLog({
        action: 'request_rejected',
        actorUserId: actorUser.id,
        entityType: 'ItemRequest',
        entityId: requestId,
        metadata: {
            previousStatus: existingRequest.status,
            newStatus: 'REJECTED',
            rejectionReason
        }
    });

    notifyITReviewComplete(updatedRequest, actorUser, 'rejected').catch(err =>
        console.error('Failed to send notification', err)
    );
    notifyITReviewCompleteInApp(updatedRequest, actorUser, 'rejected').catch(err =>
        console.error('Failed to send in-app notification', err)
    );

    emitRequestStatusChanged(updatedRequest, existingRequest.status, actorUser);

    return updatedRequest;
}

export async function approveRequest(requestId, actorUser) {
    // Get existing request first for self-approval check
    const existingRequest = await repo.getRequestById(requestId);
    if (!existingRequest) {
        const error = new Error("Request not found");
        error.name = 'NotFound';
        throw error;
    }

    // SELF-APPROVAL CHECK: Check this BEFORE RBAC for better error message
    if (existingRequest.requesterId === actorUser.id) {
        await createAuditLog({
            action: 'workflow_violation_blocked',
            actorUserId: actorUser.id,
            entityType: 'ItemRequest',
            entityId: requestId,
            metadata: {
                attemptedAction: 'approve',
                currentStatus: existingRequest.status,
                reason: 'self_approval_blocked'
            }
        });

        const error = new Error("Cannot approve your own request");
        error.name = 'Forbidden';
        throw error;
    }

    // RBAC: Must be admin or head_it (after self-approval check)
    if (!hasAdminRole(actorUser)) {
        const error = new Error("Only Admin or Head of IT can approve requests");
        error.name = 'Forbidden';
        throw error;
    }

    if (existingRequest.status !== 'IT_REVIEWED') {
        if (existingRequest.status === 'SUBMITTED') {
            await createAuditLog({
                action: 'workflow_violation_blocked',
                actorUserId: actorUser.id,
                entityType: 'ItemRequest',
                entityId: requestId,
                metadata: {
                    attemptedAction: 'approve',
                    currentStatus: existingRequest.status,
                    reason: 'it_review_required'
                }
            });
        }
        const error = new Error(`Cannot approve request in status: ${existingRequest.status}. Request must be IT reviewed first.`);
        error.name = 'ValidationError';
        throw error;
    }

    const updatedRequest = await repo.approveRequest(requestId, actorUser.id, new Date(), existingRequest.updatedAt);

    await createAuditLog({
        action: 'request_approved',
        actorUserId: actorUser.id,
        entityType: 'ItemRequest',
        entityId: requestId,
        metadata: {
            previousStatus: 'IT_REVIEWED',
            newStatus: 'APPROVED'
        }
    });

    notifyApprovalComplete(updatedRequest, actorUser, 'approved').catch(err =>
        console.error('Failed to send notification', err)
    );
    notifyApprovalCompleteInApp(updatedRequest, actorUser, 'approved').catch(err =>
        console.error('Failed to send in-app notification', err)
    );
    emitRequestStatusChanged(updatedRequest, 'IT_REVIEWED', actorUser);

    return updatedRequest;
}
