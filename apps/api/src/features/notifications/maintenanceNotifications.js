import { sendEmail } from './email/emailService.js';
import { templates as emailTemplates } from './email/maintenanceTemplates.js';
import { notificationTemplates as inAppTemplates } from './inApp/maintenanceNotifications.js';
import * as inAppRepo from './inAppRepo.js';
import * as notificationRepo from './repo.js';
import * as maintenanceRepo from '../maintenance/repo.js';
import {
    getTechnicianEmailsForWindow,
    getTechnicianIdsForWindow,
    getApproverEmails,
    getApproverIds
} from './recipientResolver.js';
import { createAuditLog } from '../audit/repo.js';
import { emitNotificationEvent } from './sseHandler.js';
import { log } from '../../shared/logging/logger.js';

const UPCOMING_EVENT_TYPE = 'notification.maintenance.upcoming';
const OVERDUE_EVENT_TYPE = 'notification.maintenance.overdue';

const toUniqueList = (values = []) => {
    return [...new Set(
        values
            .filter((value) => typeof value === 'string' && value.trim().length > 0)
            .map((value) => value.trim())
    )];
};

const initChannelResult = (intendedRecipients = []) => ({
    intendedRecipients,
    deliveredRecipients: [],
    failedRecipients: [],
    status: intendedRecipients.length > 0 ? 'pending' : 'skipped',
    error: null
});

const resolveOverallStatus = (channels = []) => {
    const activeChannels = channels.filter((channel) => channel.status !== 'skipped');

    if (activeChannels.length === 0) {
        return 'skipped';
    }

    const hasFailure = activeChannels.some((channel) => channel.status === 'failed');
    const hasSuccess = activeChannels.some((channel) => channel.status === 'success');

    if (hasSuccess && hasFailure) {
        return 'partial';
    }

    if (hasFailure) {
        return 'failed';
    }

    return 'success';
};

const safeAuditLog = async ({ action, entityId, metadata }) => {
    try {
        await createAuditLog({
            action,
            entityType: 'maintenance_window',
            entityId,
            metadata
        });
    } catch (auditError) {
        log.error({
            action,
            entityId,
            error: auditError.message
        }, 'Failed to write maintenance notification audit log');
    }
};

const calculateDaysDiff = (targetDate) => {
    const now = new Date();
    const target = new Date(targetDate);
    const diffMs = target - now;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const prepareNotificationData = (maintenanceWindow) => {
    const scheduledDate = maintenanceWindow.scheduledStartDate;
    const daysDiff = calculateDaysDiff(scheduledDate);

    const technicians = maintenanceWindow.assignedTo?.username ? [maintenanceWindow.assignedTo.username] : [];
    const deviceTypes = maintenanceWindow.deviceTypes?.map((dt) => dt.deviceType) || [];

    return {
        windowId: maintenanceWindow.id,
        cycleName: maintenanceWindow.cycleConfig?.name || 'Maintenance',
        scheduledDate,
        daysUntilDue: daysDiff > 0 ? daysDiff : 0,
        daysOverdue: daysDiff < 0 ? Math.abs(daysDiff) : 0,
        assignedTechnicians: technicians,
        deviceTypes: deviceTypes.length > 0 ? deviceTypes : null
    };
};

const sendEmailNotification = async ({
    emails,
    buildTemplate,
    templateType,
    referenceId
}) => {
    const recipients = toUniqueList(emails);
    const channel = initChannelResult(recipients);

    if (recipients.length === 0) {
        return channel;
    }

    let notificationRecordId = null;

    try {
        const { subject, html, text } = buildTemplate();

        const notification = await notificationRepo.createNotificationRecord({
            recipientEmail: recipients.join(', '),
            subject,
            templateType,
            referenceType: 'maintenance_window',
            referenceId
        });
        notificationRecordId = notification.id;

        const result = await sendEmail({
            to: recipients,
            subject,
            html,
            text
        });

        channel.status = result.success ? 'success' : 'failed';
        channel.deliveredRecipients = result.success ? recipients : [];
        channel.failedRecipients = result.success ? [] : recipients;
        channel.error = result.success ? null : String(result.error || 'Email delivery failed');

        await notificationRepo.updateNotificationStatus(
            notificationRecordId,
            result.success ? 'sent' : 'failed',
            result.error
        );
    } catch (error) {
        channel.status = 'failed';
        channel.failedRecipients = recipients;
        channel.error = error.message;

        if (notificationRecordId) {
            await notificationRepo.updateNotificationStatus(notificationRecordId, 'failed', error.message);
        }
    }

    return channel;
};

const sendInAppNotification = async ({
    userIds,
    template,
    eventType
}) => {
    const recipients = toUniqueList(userIds);
    const channel = initChannelResult(recipients);

    if (recipients.length === 0) {
        return channel;
    }

    try {
        const notifications = recipients.map((userId) => ({
            userId,
            ...template
        }));

        await inAppRepo.createBulkNotifications(notifications);

        for (const userId of recipients) {
            emitNotificationEvent(userId, template, eventType);
        }

        channel.status = 'success';
        channel.deliveredRecipients = recipients;
    } catch (error) {
        channel.status = 'failed';
        channel.failedRecipients = recipients;
        channel.error = error.message;
    }

    return channel;
};

const shouldMarkNotificationAsSent = (deliveryStatus) => {
    return deliveryStatus === 'success' || deliveryStatus === 'partial';
};

export const notifyUpcomingMaintenance = async (maintenanceWindow) => {
    try {
        if (maintenanceWindow.upcomingNotificationSentAt) {
            log.debug('Upcoming notification already sent for window', { windowId: maintenanceWindow.id });
            return;
        }

        const data = prepareNotificationData(maintenanceWindow);
        const technicianEmails = toUniqueList(await getTechnicianEmailsForWindow(maintenanceWindow.id));
        const technicianIds = toUniqueList(await getTechnicianIdsForWindow(maintenanceWindow.id));

        if (technicianEmails.length === 0 && technicianIds.length === 0) {
            log.warn('No assigned technicians for maintenance window', { windowId: maintenanceWindow.id });
        }

        const emailChannel = await sendEmailNotification({
            emails: technicianEmails,
            buildTemplate: () => emailTemplates.upcomingMaintenance(data),
            templateType: 'maintenance_upcoming',
            referenceId: maintenanceWindow.id
        });

        const inAppTemplate = inAppTemplates.upcomingMaintenance(data);
        const inAppChannel = await sendInAppNotification({
            userIds: technicianIds,
            template: inAppTemplate,
            eventType: UPCOMING_EVENT_TYPE
        });

        const deliveryStatus = resolveOverallStatus([emailChannel, inAppChannel]);

        if (shouldMarkNotificationAsSent(deliveryStatus)) {
            await maintenanceRepo.markUpcomingNotificationSent(maintenanceWindow.id);
        }

        await safeAuditLog({
            action: 'notification.maintenance.upcoming',
            entityId: maintenanceWindow.id,
            metadata: {
                deliveryStatus,
                recipients: {
                    email: emailChannel,
                    inApp: inAppChannel
                }
            }
        });

        if (deliveryStatus === 'failed') {
            log.warn('Upcoming maintenance notification failed', {
                windowId: maintenanceWindow.id
            });
            return;
        }

        log.info('Upcoming maintenance notification processed', {
            windowId: maintenanceWindow.id,
            deliveryStatus
        });
    } catch (error) {
        await safeAuditLog({
            action: 'notification.maintenance.upcoming',
            entityId: maintenanceWindow.id,
            metadata: {
                deliveryStatus: 'failed',
                error: error.message
            }
        });

        log.error('Failed to send upcoming maintenance notification', {
            error: error.message,
            windowId: maintenanceWindow.id
        });
    }
};

export const notifyOverdueMaintenance = async (maintenanceWindow) => {
    try {
        if (maintenanceWindow.overdueNotificationSentAt) {
            log.debug('Overdue notification already sent for window', { windowId: maintenanceWindow.id });
            return;
        }

        const data = prepareNotificationData(maintenanceWindow);

        const technicianEmails = toUniqueList(await getTechnicianEmailsForWindow(maintenanceWindow.id));
        const technicianIds = toUniqueList(await getTechnicianIdsForWindow(maintenanceWindow.id));
        const adminEmails = toUniqueList(await getApproverEmails());
        const adminIds = toUniqueList(await getApproverIds());

        const technicianEmailChannel = await sendEmailNotification({
            emails: technicianEmails,
            buildTemplate: () => emailTemplates.overdueMaintenance({ ...data, isEscalation: false }),
            templateType: 'maintenance_overdue',
            referenceId: maintenanceWindow.id
        });

        const escalationEmailChannel = await sendEmailNotification({
            emails: adminEmails,
            buildTemplate: () => emailTemplates.overdueMaintenance({ ...data, isEscalation: true }),
            templateType: 'maintenance_overdue_escalation',
            referenceId: maintenanceWindow.id
        });

        const emailChannel = {
            ...initChannelResult(toUniqueList([...technicianEmails, ...adminEmails])),
            deliveredRecipients: toUniqueList([
                ...technicianEmailChannel.deliveredRecipients,
                ...escalationEmailChannel.deliveredRecipients
            ]),
            failedRecipients: toUniqueList([
                ...technicianEmailChannel.failedRecipients,
                ...escalationEmailChannel.failedRecipients
            ]),
            status: resolveOverallStatus([technicianEmailChannel, escalationEmailChannel]),
            error: [technicianEmailChannel.error, escalationEmailChannel.error].filter(Boolean).join(' | ') || null,
            breakdown: {
                technicians: technicianEmailChannel,
                escalations: escalationEmailChannel
            }
        };

        const allUserIds = toUniqueList([...technicianIds, ...adminIds]);
        const inAppTemplate = inAppTemplates.overdueMaintenance(data);
        const inAppChannel = await sendInAppNotification({
            userIds: allUserIds,
            template: inAppTemplate,
            eventType: OVERDUE_EVENT_TYPE
        });

        const deliveryStatus = resolveOverallStatus([emailChannel, inAppChannel]);

        if (shouldMarkNotificationAsSent(deliveryStatus)) {
            await maintenanceRepo.markOverdueNotificationSent(maintenanceWindow.id);
        }

        await safeAuditLog({
            action: 'notification.maintenance.overdue',
            entityId: maintenanceWindow.id,
            metadata: {
                deliveryStatus,
                escalatedToAdmins: adminIds.length > 0,
                recipients: {
                    email: emailChannel,
                    inApp: inAppChannel
                }
            }
        });

        if (deliveryStatus === 'failed') {
            log.warn('Overdue maintenance notification failed', {
                windowId: maintenanceWindow.id
            });
            return;
        }

        log.info('Overdue maintenance notification processed', {
            windowId: maintenanceWindow.id,
            deliveryStatus,
            escalated: adminIds.length > 0
        });
    } catch (error) {
        await safeAuditLog({
            action: 'notification.maintenance.overdue',
            entityId: maintenanceWindow.id,
            metadata: {
                deliveryStatus: 'failed',
                error: error.message
            }
        });

        log.error('Failed to send overdue maintenance notification', {
            error: error.message,
            windowId: maintenanceWindow.id
        });
    }
};
