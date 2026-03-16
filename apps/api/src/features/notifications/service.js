
import { sendEmail } from './email/emailService.js';
import { templates } from './email/emailTemplates.js';
import * as repo from './repo.js';
import * as inAppRepo from './inAppRepo.js';
import { notificationTemplates } from './inAppTemplates.js';
import { sendToUser } from './sseHandler.js';
import { getITStaffEmails, getApproverEmails, getUserEmail, getITStaffIds, getApproverIds } from './recipientResolver.js';
import { createAuditLog } from '../audit/repo.js';
import { log } from '../../shared/logging/logger.js';

// Default dependencies for testing (DI)
const defaultDeps = {
    sendEmail,
    templates,
    notificationRepo: repo,
    recipientResolver: { getITStaffEmails, getApproverEmails, getUserEmail },
    auditRepo: { createAuditLog },
    logger: log
};

/**
 * Send notification for new request submission
 * @param {Object} request - The created request
 * @param {Object} requester - The user who submitted the request
 * @param {Object} deps - Dependencies (optional, for testing)
 */
export const notifyNewRequest = async (request, requester, deps = defaultDeps) => {
    const { sendEmail, templates, notificationRepo, recipientResolver, auditRepo, logger } = deps;
    try {
        const recipients = await recipientResolver.getITStaffEmails();
        if (!recipients.length) {
            logger.warn('No IT staff emails found for notification');
            return;
        }

        const templateData = {
            requestId: request.id,
            itemName: request.itemName,
            description: request.description,
            priority: request.priority,
            requesterName: requester.username || 'Unknown User',
            submittedAt: request.createdAt
        };

        const { subject, html, text } = templates.newRequestSubmitted(templateData);

        // Record notification attempt
        const notification = await notificationRepo.createNotificationRecord({
            recipientEmail: recipients.join(', '),
            subject,
            templateType: 'new_request_submitted',
            referenceType: 'item_request',
            referenceId: request.id
        });

        const result = await sendEmail({ to: recipients, subject, html, text });

        // Update notification status
        await notificationRepo.updateNotificationStatus(
            notification.id,
            result.success ? 'sent' : 'failed',
            result.error
        );

        // Audit log
        await auditRepo.createAuditLog({
            action: result.success ? 'notification.email.sent' : 'notification.email.failed',
            actorUserId: null,
            entityType: 'item_request',
            entityId: request.id,
            metadata: {
                recipientCount: recipients.length,
                templateType: 'new_request_submitted',
                error: result.error
            }
        });
    } catch (error) {
        logger.error('Failed to send new request notification', { error: error.message, requestId: request.id });
    }
};

/**
 * Send notification when IT review is complete
 * @param {Object} request - The reviewed request
 * @param {Object} reviewer - The IT staff who reviewed
 * @param {string} outcome - 'reviewed' | 'rejected' | 'already_purchased'
 * @param {Object} deps - Dependencies (optional, for testing)
 */
export const notifyITReviewComplete = async (request, reviewer, outcome, deps = defaultDeps) => {
    const { sendEmail, templates, notificationRepo, recipientResolver, auditRepo, logger } = deps;
    try {
        // Notify the requester
        const requesterEmail = await recipientResolver.getUserEmail(request.requesterId);
        if (requesterEmail) {
            const statusConfig = {
                reviewed: { statusLabel: 'IT Reviewed', statusClass: 'reviewed', nextSteps: 'Awaiting final approval from Admin/Head of IT.' },
                rejected: { statusLabel: 'Rejected', statusClass: 'rejected', nextSteps: null },
                already_purchased: { statusLabel: 'Already Available', statusClass: 'reviewed', nextSteps: 'The item is already in stock. IT will contact you.' }
            };

            const config = statusConfig[outcome] || statusConfig.reviewed;

            const templateData = {
                itemName: request.itemName,
                reviewerName: reviewer?.username || 'IT Staff',
                reviewNotes: request.itReview || request.rejectionReason,
                statusLabel: config.statusLabel,
                statusClass: config.statusClass,
                nextSteps: config.nextSteps
            };

            const { subject, html, text } = templates.requestReviewed(templateData);

            const notification = await notificationRepo.createNotificationRecord({
                recipientEmail: requesterEmail,
                recipientUserId: request.requesterId,
                subject,
                templateType: 'request_reviewed',
                referenceType: 'item_request',
                referenceId: request.id
            });

            const result = await sendEmail({ to: requesterEmail, subject, html, text });
            await notificationRepo.updateNotificationStatus(notification.id, result.success ? 'sent' : 'failed', result.error);
        }

        // If reviewed (not rejected/already_purchased), notify approvers
        if (outcome === 'reviewed') {
            const approverEmails = await recipientResolver.getApproverEmails();
            if (approverEmails.length) {
                const requesterName = request.requester?.username || 'Unknown';

                const templateData = {
                    requestId: request.id,
                    itemName: request.itemName,
                    priority: request.priority,
                    requesterName,
                    reviewerName: reviewer?.username || 'IT Staff',
                    reviewNotes: request.itReview
                };

                const { subject, html, text } = templates.pendingApproval(templateData);

                const notification = await notificationRepo.createNotificationRecord({
                    recipientEmail: approverEmails.join(', '),
                    subject,
                    templateType: 'pending_approval',
                    referenceType: 'item_request',
                    referenceId: request.id
                });

                const result = await sendEmail({ to: approverEmails, subject, html, text });
                await notificationRepo.updateNotificationStatus(notification.id, result.success ? 'sent' : 'failed', result.error);
            }
        }
    } catch (error) {
        logger.error('Failed to send IT review notification', { error: error.message, requestId: request.id });
    }
};

/**
 * Send notification when approval is complete
 * @param {Object} request - The approved/rejected request
 * @param {Object} approver - The admin who approved/rejected
 * @param {string} outcome - 'approved' | 'rejected'
 * @param {Object} deps - Dependencies (optional, for testing)
 */
export const notifyApprovalComplete = async (request, approver, outcome, deps = defaultDeps) => {
    const { sendEmail, templates, notificationRepo, recipientResolver, auditRepo, logger } = deps;
    try {
        const requesterEmail = await recipientResolver.getUserEmail(request.requesterId);
        if (!requesterEmail) {
            logger.warn('Requester email not found for approval notification', { requesterId: request.requesterId });
            return;
        }

        const template = outcome === 'approved' ? templates.requestApproved : templates.requestRejected;
        const templateData = {
            itemName: request.itemName,
            approverName: approver?.username || 'Admin',
            reviewerName: approver?.username || 'Admin',
            approvedAt: request.approvedAt || new Date(),
            rejectionReason: request.rejectionReason
        };

        const { subject, html, text } = template(templateData);

        const notification = await notificationRepo.createNotificationRecord({
            recipientEmail: requesterEmail,
            recipientUserId: request.requesterId,
            subject,
            templateType: outcome === 'approved' ? 'request_approved' : 'request_rejected',
            referenceType: 'item_request',
            referenceId: request.id
        });

        const result = await sendEmail({ to: requesterEmail, subject, html, text });
        await notificationRepo.updateNotificationStatus(notification.id, result.success ? 'sent' : 'failed', result.error);

        await auditRepo.createAuditLog({
            action: result.success ? 'notification.email.sent' : 'notification.email.failed',
            actorUserId: null,
            entityType: 'item_request',
            entityId: request.id,
            metadata: {
                templateType: outcome === 'approved' ? 'request_approved' : 'request_rejected',
                recipient: requesterEmail,
                error: result.error
            }
        });
    } catch (error) {
        logger.error('Failed to send approval notification', { error: error.message, requestId: request.id });
    }
};

// ============================================================================
// IN-APP NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Send in-app notification for new request submission
 * @param {Object} request - The created request
 * @param {Object} requester - The user who submitted the request
 */
export const notifyNewRequestInApp = async (request, requester) => {
    try {
        const recipientIds = await getITStaffIds();
        if (!recipientIds.length) {
            log.warn('No IT staff found for in-app notification');
            return;
        }

        const template = notificationTemplates.requestSubmitted({
            requestId: request.id,
            itemName: request.itemName,
            requesterName: requester.username || 'Unknown User'
        });

        const notifications = recipientIds.map(userId => ({
            userId,
            ...template
        }));

        const createdNotifications = await inAppRepo.createBulkNotifications(notifications);
        createdNotifications.forEach(n => sendToUser(n.userId, n));
    } catch (error) {
        log.error('Failed to send in-app notification for new request', {
            error: error.message,
            requestId: request.id
        });
    }
};

/**
 * Send in-app notifications when IT review is complete
 * @param {Object} request - The reviewed request
 * @param {Object} reviewer - The IT staff who reviewed
 * @param {string} outcome - 'reviewed' | 'rejected' | 'already_purchased'
 */
export const notifyITReviewCompleteInApp = async (request, reviewer, outcome) => {
    try {
        // Notify the requester
        const statusConfig = {
            reviewed: { statusLabel: 'IT Reviewed' },
            rejected: { statusLabel: 'Rejected' },
            already_purchased: { statusLabel: 'Already Available' }
        };

        const config = statusConfig[outcome] || statusConfig.reviewed;
        const template = outcome === 'rejected'
            ? notificationTemplates.requestRejected({
                requestId: request.id,
                itemName: request.itemName
            })
            : notificationTemplates.requestReviewed({
                requestId: request.id,
                itemName: request.itemName,
                statusLabel: config.statusLabel
            });

        const notification = await inAppRepo.createNotification({
            userId: request.requesterId,
            ...template
        });
        sendToUser(notification.userId, notification);

        // If IT reviewed (not rejected/already_purchased), notify approvers
        if (outcome === 'reviewed') {
            const approverIds = await getApproverIds();
            if (approverIds.length) {
                const approverTemplate = notificationTemplates.pendingApproval({
                    requestId: request.id,
                    itemName: request.itemName,
                    requesterName: request.requester?.username || 'Unknown'
                });

                const notifications = approverIds.map(userId => ({
                    userId,
                    ...approverTemplate
                }));

                const createdApproverNotifications = await inAppRepo.createBulkNotifications(notifications);
                createdApproverNotifications.forEach(n => sendToUser(n.userId, n));
            }
        }
    } catch (error) {
        log.error('Failed to send in-app notification for IT review', {
            error: error.message,
            requestId: request.id
        });
    }
};

/**
 * Send in-app notification when approval is complete
 * @param {Object} request - The approved/rejected request
 * @param {Object} approver - The admin who approved/rejected
 * @param {string} outcome - 'approved' | 'rejected'
 */
export const notifyApprovalCompleteInApp = async (request, approver, outcome) => {
    try {
        const template = outcome === 'approved'
            ? notificationTemplates.requestApproved({
                requestId: request.id,
                itemName: request.itemName
            })
            : notificationTemplates.requestRejected({
                requestId: request.id,
                itemName: request.itemName
            });

        const notification = await inAppRepo.createNotification({
            userId: request.requesterId,
            ...template
        });
        sendToUser(notification.userId, notification);
    } catch (error) {
        log.error('Failed to send in-app notification for approval', {
            error: error.message,
            requestId: request.id
        });
    }
};
