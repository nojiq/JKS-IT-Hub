import * as repo from './repo.js';
import { notifyUpcomingMaintenance, notifyOverdueMaintenance } from '../notifications/maintenanceNotifications.js';
import { emitMaintenanceStatusChanged } from './events.js';

export const calculateNextWindowDate = (startDate, intervalMonths) => {
    const nextDate = new Date(startDate);
    nextDate.setMonth(nextDate.getMonth() + intervalMonths);
    // Handle month-end edge cases behavior (automatic adjustment by Date object is accepted)
    return nextDate;
};

const validateDateRange = (startDate, endDate = null) => {
    if (!startDate || Number.isNaN(new Date(startDate).getTime())) {
        const error = new Error('Invalid scheduled start date');
        error.statusCode = 400;
        throw error;
    }

    if (endDate) {
        const end = new Date(endDate);
        const start = new Date(startDate);
        if (Number.isNaN(end.getTime())) {
            const error = new Error('Invalid scheduled end date');
            error.statusCode = 400;
            throw error;
        }
        if (end < start) {
            const error = new Error('Scheduled end date must be on or after scheduled start date');
            error.statusCode = 400;
            throw error;
        }
    }
};

export const generateMaintenanceWindows = async (cycleConfigId, startDate, endDate, actorUserId = 'system', department = null) => {
    // 1. Get cycle config to know interval
    const cycleConfig = await repo.getCycleConfigById(cycleConfigId);
    if (!cycleConfig) throw new Error('Cycle not found');

    let checklistData = {};
    if (cycleConfig.defaultChecklistTemplateId) {
        const template = await repo.getChecklistTemplateById(cycleConfig.defaultChecklistTemplateId, true);
        if (template && template.isActive) {
            checklistData = {
                checklistTemplateId: template.id,
                checklistVersion: template.version,
                checklistSnapshot: {
                    templateId: template.id,
                    name: template.name,
                    version: template.version,
                    items: (template.items || []).map((item) => ({
                        id: item.id,
                        title: item.title,
                        description: item.description ?? null,
                        isRequired: item.isRequired,
                        orderIndex: item.orderIndex
                    }))
                }
            };
        }
    }

    validateDateRange(startDate, endDate);

    const windows = [];
    let currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
        const overlap = await repo.findOverlappingMaintenanceWindow(
            cycleConfigId,
            currentDate,
            null
        );
        if (overlap) {
            currentDate = calculateNextWindowDate(currentDate, cycleConfig.intervalMonths);
            continue;
        }

        // Create window data
        const windowData = {
            cycleConfigId,
            scheduledStartDate: new Date(currentDate),
            status: 'SCHEDULED',
            createdById: actorUserId,
            ...checklistData
        };

        // Add department if provided
        if (department) {
            windowData.departmentId = department;
        }

        // Create window
        let window = await repo.createMaintenanceWindow(windowData);

        // Auto-assign if department configured
        if (department) {
            try {
                const { autoAssignMaintenanceWindow } = await import('./assignment.js');
                const assignedWindow = await autoAssignMaintenanceWindow(window.id, department);
                if (assignedWindow) {
                    window = assignedWindow;
                }
            } catch (error) {
                console.warn(`Failed to auto-assign window ${window.id}`, {
                    error: error.message,
                    department
                });
                // Continue even if assignment fails
            }
        }

        windows.push(window);

        // Calculate next date
        currentDate = calculateNextWindowDate(currentDate, cycleConfig.intervalMonths);
    }

    return windows;
};

export const generateFutureWindows = async (cycleConfigId, monthsAhead = 12, actorUserId = 'system', department = null) => {
    // 1. Load cycle configuration
    const cycleConfig = await repo.getCycleConfigById(cycleConfigId);
    if (!cycleConfig) throw new Error('Cycle not found');
    if (!cycleConfig.isActive) return []; // Don't generate for inactive configs

    let checklistData = {};
    if (cycleConfig.defaultChecklistTemplateId) {
        const template = await repo.getChecklistTemplateById(cycleConfig.defaultChecklistTemplateId, true);
        if (template && template.isActive) {
            checklistData = {
                checklistTemplateId: template.id,
                checklistVersion: template.version,
                checklistSnapshot: {
                    templateId: template.id,
                    name: template.name,
                    version: template.version,
                    items: (template.items || []).map((item) => ({
                        id: item.id,
                        title: item.title,
                        description: item.description ?? null,
                        isRequired: item.isRequired,
                        orderIndex: item.orderIndex
                    }))
                }
            };
        }
    }

    // 2. Find the latest existing window for this cycle to determine start point
    const existingWindowsResult = await repo.getMaintenanceWindowsByCycleId(cycleConfigId, {
        orderBy: { scheduledStartDate: 'desc' },
        limit: 1
    });
    const existingWindows = existingWindowsResult.data;

    // 3. Calculate start date for next window
    let nextDate;
    if (existingWindows.length > 0) {
        // Start from latest window + interval
        const lastDate = existingWindows[0].scheduledStartDate;
        nextDate = calculateNextWindowDate(lastDate, cycleConfig.intervalMonths);
    } else {
        // No existing windows, start from now + interval
        const now = new Date();
        nextDate = calculateNextWindowDate(now, cycleConfig.intervalMonths);
    }

    // 4. Generate windows until monthsAhead limit
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + monthsAhead);

    const newWindows = [];
    // Safety break to prevent infinite loops if interval is 0 (though schema validation prevents 0)
    let safetyCounter = 0;
    while (nextDate <= endDate && safetyCounter < 100) {
        const overlap = await repo.findOverlappingMaintenanceWindow(
            cycleConfigId,
            nextDate,
            null
        );
        if (overlap) {
            nextDate = calculateNextWindowDate(nextDate, cycleConfig.intervalMonths);
            safetyCounter++;
            continue;
        }

        const windowData = {
            cycleConfigId,
            scheduledStartDate: new Date(nextDate),
            status: 'SCHEDULED',
            createdById: actorUserId,
            ...checklistData
        };

        // Add department if provided
        if (department) {
            windowData.departmentId = department;
        }

        let window = await repo.createMaintenanceWindow(windowData);

        // Auto-assign if department configured
        if (department) {
            try {
                const { autoAssignMaintenanceWindow } = await import('./assignment.js');
                const assignedWindow = await autoAssignMaintenanceWindow(window.id, department);
                if (assignedWindow) {
                    window = assignedWindow;
                }
            } catch (error) {
                console.warn(`Failed to auto-assign window ${window.id}`, {
                    error: error.message,
                    department
                });
                // Continue even if assignment fails
            }
        }

        newWindows.push(window);

        // Calculate next window
        nextDate = calculateNextWindowDate(nextDate, cycleConfig.intervalMonths);
        safetyCounter++;
    }

    return newWindows;
};

const STATUS_UPDATE_BATCH_SIZE = 500;

const batchUpdateWindowStatus = async (queryFilters, nextStatus) => {
    let totalUpdated = 0;

    while (true) {
        const { data: batch } = await repo.getMaintenanceWindowsByCycleId(null, {
            ...queryFilters,
            page: 1,
            limit: STATUS_UPDATE_BATCH_SIZE
        });

        if (!batch.length) break;

        const updatedWindows = await Promise.all(
            batch.map(async (window) => {
                const updated = await repo.updateWindowStatus(window.id, nextStatus);
                return { previous: window, updated };
            })
        );
        for (const { previous, updated } of updatedWindows) {
            emitMaintenanceStatusChanged(updated, previous.status, null);
        }
        totalUpdated += batch.length;

        if (batch.length < STATUS_UPDATE_BATCH_SIZE) break;
    }

    return totalUpdated;
};

export const updateWindowStatuses = async (options = {}) => {
    const { sendNotifications = true } = options;
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Find future SCHEDULED windows within 30 days -> set to UPCOMING
    const upcomingUpdatedCount = await batchUpdateWindowStatus({
        status: 'SCHEDULED',
        scheduledStartDateGte: now,
        scheduledStartDateLte: thirtyDaysFromNow,
    }, 'UPCOMING');

    // Find UPCOMING or SCHEDULED windows past scheduled date -> set to OVERDUE
    const overdueUpdatedCount = await batchUpdateWindowStatus({
        status: ['UPCOMING', 'SCHEDULED'],
        scheduledStartDateLt: now,
    }, 'OVERDUE');

    let notificationsSent = { upcoming: 0, overdue: 0 };
    if (sendNotifications) {
        // 1. Upcoming Notifications for windows in UPCOMING status (within 30 days)
        const upcomingNotifications = await repo.getWindowsNeedingUpcomingNotification(30);
        const upcomingSentResults = await Promise.allSettled(
            upcomingNotifications.map(w => notifyUpcomingMaintenance(w))
        );

        // 2. Overdue Notifications (immediate + periodic if needed, though logic is one-time for now per flag)
        const overdueNotifications = await repo.getWindowsNeedingOverdueNotification();
        const overdueSentResults = await Promise.allSettled(
            overdueNotifications.map(w => notifyOverdueMaintenance(w))
        );

        notificationsSent = {
            upcoming: upcomingSentResults.filter(r => r.status === 'fulfilled').length,
            overdue: overdueSentResults.filter(r => r.status === 'fulfilled').length
        };
    }

    return {
        upcomingUpdatedCount,
        overdueUpdatedCount,
        notificationsSent
    };
};
