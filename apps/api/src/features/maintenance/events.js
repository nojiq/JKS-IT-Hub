import { emitToUsers } from '../notifications/sseHandler.js';
import { getMaintenanceEventRecipients } from '../notifications/sseRecipients.js';
import { log } from '../../shared/logging/logger.js';

const emitToMaintenanceRecipients = (maintenance, type, payload) => {
    const recipients = getMaintenanceEventRecipients(maintenance);
    if (recipients.length === 0) return;
    emitToUsers(recipients, { type, data: payload });
};

/**
 * Emit event when maintenance schedule status changes
 */
export const emitMaintenanceStatusChanged = (maintenance, previousStatus, actor) => {
    try {
        const payload = {
            windowId: maintenance.id,
            maintenanceId: maintenance.id,
            cycleConfigId: maintenance.cycleConfigId,
            newStatus: maintenance.status,
            previousStatus,
            scheduledStartDate: maintenance.scheduledStartDate,
            scheduledEndDate: maintenance.scheduledEndDate ?? null,
            updatedAt: maintenance.updatedAt ?? new Date().toISOString(),
            actorId: actor?.id ?? null,
            actorName: actor?.username
        };

        emitToMaintenanceRecipients(maintenance, 'maintenance.updated', payload);

        if (maintenance.status === 'UPCOMING') {
            emitMaintenanceUpcoming(maintenance, previousStatus, actor);
        }
        if (maintenance.status === 'OVERDUE') {
            emitMaintenanceOverdue(maintenance, previousStatus, actor);
        }
    } catch (error) {
        log.error({ error: error.message, maintenanceId: maintenance.id }, 'Failed to emit maintenance.updated event');
    }
};

/**
 * Emit event when maintenance is completed
 */
export const emitMaintenanceCompleted = (maintenance, actor) => {
    try {
        const payload = {
            windowId: maintenance.id,
            maintenanceId: maintenance.id,
            completedBy: actor?.id ?? null,
            completedByName: actor?.username ?? null,
            completedAt: maintenance.completedAt ?? new Date().toISOString(),
            notes: maintenance.completionRemarks ?? null,
            signoffMode: maintenance.signoffMode ?? 'STANDARD',
            signerName: maintenance.signerName ?? null,
            signerConfirmedAt: maintenance.signerConfirmedAt ?? null
        };

        emitToMaintenanceRecipients(maintenance, 'maintenance.completed', payload);
    } catch (error) {
        log.error({ error: error.message, maintenanceId: maintenance.id }, 'Failed to emit maintenance.completed event');
    }
};

/**
 * Emit event when maintenance enters UPCOMING status
 */
export const emitMaintenanceUpcoming = (maintenance, previousStatus, actor) => {
    try {
        const payload = {
            windowId: maintenance.id,
            maintenanceId: maintenance.id,
            newStatus: 'UPCOMING',
            previousStatus: previousStatus ?? null,
            scheduledStartDate: maintenance.scheduledStartDate,
            actorId: actor?.id ?? null,
            actorName: actor?.username ?? null,
            timestamp: new Date().toISOString()
        };
        emitToMaintenanceRecipients(maintenance, 'maintenance.upcoming', payload);
    } catch (error) {
        log.error({ error: error.message, maintenanceId: maintenance.id }, 'Failed to emit maintenance.upcoming event');
    }
};

/**
 * Emit event when maintenance enters OVERDUE status
 */
export const emitMaintenanceOverdue = (maintenance, previousStatus, actor) => {
    try {
        const payload = {
            windowId: maintenance.id,
            maintenanceId: maintenance.id,
            newStatus: 'OVERDUE',
            previousStatus: previousStatus ?? null,
            scheduledStartDate: maintenance.scheduledStartDate,
            actorId: actor?.id ?? null,
            actorName: actor?.username ?? null,
            timestamp: new Date().toISOString()
        };
        emitToMaintenanceRecipients(maintenance, 'maintenance.overdue', payload);
    } catch (error) {
        log.error({ error: error.message, maintenanceId: maintenance.id }, 'Failed to emit maintenance.overdue event');
    }
};
