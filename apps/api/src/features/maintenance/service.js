import * as repo from './repo.js';
import * as scheduler from './scheduler.js';
import * as auditRepo from '../audit/repo.js';
import * as schema from './schema.js';
import { domainEvents } from '../../shared/events/index.js';
import { emitMaintenanceStatusChanged, emitMaintenanceCompleted } from './events.js';
import * as assignmentService from './assignment.js';
import { prisma } from '../../shared/db/prisma.js';
import { randomUUID } from 'node:crypto';
import { deleteFile, ensureUploadDir, saveFile } from '../../shared/uploads/storage.js';

const ALLOWED_ROLES = ['it', 'admin', 'head_it'];
const SIGNATURE_DATA_URL_PREFIX = 'data:image/png;base64,';
const MAX_SIGNATURE_SIZE_BYTES = 300 * 1024;
export const MAINTENANCE_CONFIG_REQUIRED_FIELDS = Object.freeze([
    'id',
    'name',
    'description',
    'intervalMonths',
    'isActive',
    'defaultChecklistTemplateId',
    'defaultChecklist',
    'createdAt',
    'updatedAt'
]);

const normalizeChecklistSummary = (checklist) => {
    if (!checklist) return null;

    const itemCount = typeof checklist.itemCount === 'number'
        ? checklist.itemCount
        : checklist._count?.items ?? 0;

    return {
        id: checklist.id ?? null,
        name: checklist.name ?? null,
        version: checklist.version ?? null,
        itemCount
    };
};

const normalizeCycleConfig = (cycle) => {
    if (!cycle) return cycle;

    return {
        id: cycle.id,
        name: cycle.name,
        description: cycle.description ?? null,
        intervalMonths: cycle.intervalMonths,
        isActive: Boolean(cycle.isActive),
        defaultChecklistTemplateId: cycle.defaultChecklistTemplateId ?? null,
        defaultChecklist: normalizeChecklistSummary(cycle.defaultChecklist),
        createdAt: cycle.createdAt ?? null,
        updatedAt: cycle.updatedAt ?? null
    };
};

const normalizeCycleConfigList = (cycles = []) => {
    if (!Array.isArray(cycles)) return [];
    return cycles.map(normalizeCycleConfig);
};

const ensureAuthorized = (user) => {
    if (!user) throw new Error('Unauthenticated');
    if (!ALLOWED_ROLES.includes(user.role)) {
        const error = new Error('Unauthorized');
        error.statusCode = 403;
        throw error;
    }
};

const ensureAuthenticated = (user) => {
    if (!user) {
        const error = new Error('Unauthenticated');
        error.statusCode = 401;
        throw error;
    }
};

const decodeSignatureDataUrl = (signatureDataUrl) => {
    if (!signatureDataUrl.startsWith(SIGNATURE_DATA_URL_PREFIX)) {
        const error = new Error('Invalid signature data URL format');
        error.statusCode = 400;
        throw error;
    }

    const base64Payload = signatureDataUrl.slice(SIGNATURE_DATA_URL_PREFIX.length);
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Payload)) {
        const error = new Error('Invalid signature data URL payload');
        error.statusCode = 400;
        throw error;
    }

    const buffer = Buffer.from(base64Payload, 'base64');
    if (buffer.length === 0) {
        const error = new Error('Signature image cannot be empty');
        error.statusCode = 400;
        throw error;
    }

    if (buffer.length > MAX_SIGNATURE_SIZE_BYTES) {
        const error = new Error(`Signature image exceeds max size of ${MAX_SIGNATURE_SIZE_BYTES} bytes`);
        error.statusCode = 400;
        throw error;
    }

    return buffer;
};

const saveAssistedSignature = async (windowId, signatureDataUrl) => {
    const buffer = decodeSignatureDataUrl(signatureDataUrl);
    await ensureUploadDir();
    const fileName = `pm-signature-${windowId}-${Date.now()}-${randomUUID()}.png`;
    await saveFile(buffer, fileName);
    return `/api/v1/uploads/${fileName}`;
};

const validateWindowDateRange = (startDate, endDate = null) => {
    if (!startDate || Number.isNaN(new Date(startDate).getTime())) {
        const error = new Error('Invalid scheduled start date');
        error.statusCode = 400;
        throw error;
    }

    if (!endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
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
};

const assertNoWindowOverlap = async (cycleConfigId, startDate, endDate = null, excludeWindowId = null, tx = prisma) => {
    const overlap = await repo.findOverlappingMaintenanceWindow(
        cycleConfigId,
        startDate,
        endDate,
        excludeWindowId,
        tx
    );
    if (overlap) {
        const error = new Error('Overlapping maintenance window exists for this cycle');
        error.statusCode = 409;
        throw error;
    }
};

const getActiveChecklistTemplate = async (checklistTemplateId) => {
    if (!checklistTemplateId) return null;
    const template = await repo.getChecklistTemplateById(checklistTemplateId);
    if (!template || !template.isActive) {
        const error = new Error('Checklist template not found or inactive');
        error.statusCode = 400;
        throw error;
    }
    return template;
};

const buildWindowChecklistData = async (checklistTemplateId) => {
    if (!checklistTemplateId) return {};
    const template = await getActiveChecklistTemplate(checklistTemplateId);
    return {
        checklistTemplateId: template.id,
        checklistVersion: template.version
    };
};

const getCycleOr404 = async (cycleConfigId) => {
    const cycle = await repo.getCycleConfigById(cycleConfigId);
    if (!cycle) {
        const error = new Error('Cycle not found');
        error.statusCode = 404;
        throw error;
    }
    return cycle;
};

const resolveWindowChecklistTemplateId = (cycle, explicitChecklistTemplateId) => {
    return explicitChecklistTemplateId ?? cycle.defaultChecklistTemplateId ?? null;
};

const getChecklistItemsForWindow = (window) => {
    const snapshotItems = window?.checklistSnapshot?.items;
    if (Array.isArray(snapshotItems) && snapshotItems.length > 0) {
        return snapshotItems.map((item) => ({
            id: item.id ?? item.checklistItemId,
            title: item.title ?? item.itemTitle,
            description: item.description ?? item.itemDescription ?? null,
            isRequired: Boolean(item.isRequired),
            orderIndex: item.orderIndex ?? 0
        })).sort((a, b) => a.orderIndex - b.orderIndex);
    }
    return window?.checklist?.items ?? [];
};

const toDeviceTypeArray = (values = []) => {
    if (!Array.isArray(values)) return [];
    return values
        .map((value) => (typeof value === 'string' ? value : value?.deviceType))
        .filter(Boolean);
};

const normalizeWindowDeviceTypes = (window) => {
    if (!window) return window;
    return {
        ...window,
        deviceTypes: toDeviceTypeArray(window.deviceTypes)
    };
};

const normalizeWindowListResult = (result) => {
    if (!result || !Array.isArray(result.data)) return result;
    return {
        ...result,
        data: result.data.map(normalizeWindowDeviceTypes)
    };
};

const normalizeCompletionDeviceTypes = (completion) => {
    if (!completion) return completion;
    return {
        ...completion,
        deviceTypes: Array.isArray(completion.deviceTypes)
            ? completion.deviceTypes.filter((value) => typeof value === 'string')
            : completion.deviceTypes,
        window: normalizeWindowDeviceTypes(completion.window)
    };
};

const normalizeCompletionListResult = (result) => {
    if (!result || !Array.isArray(result.data)) return result;
    return {
        ...result,
        data: result.data.map(normalizeCompletionDeviceTypes)
    };
};

// Cycle Management
export const createMaintenanceCycle = async (data, actorUser) => {
    ensureAuthorized(actorUser);
    const validated = schema.createCycleSchema.parse(data);
    if (validated.defaultChecklistTemplateId) {
        await getActiveChecklistTemplate(validated.defaultChecklistTemplateId);
    }

    const cycle = await repo.createCycleConfig(validated);

    await auditRepo.createAuditLog({
        action: 'MAINTENANCE_CYCLE:CREATE',
        actorUserId: actorUser.id,
        entityType: 'MaintenanceCycleConfig',
        entityId: cycle.id,
        metadata: { name: cycle.name }
    });

    return normalizeCycleConfig(cycle);
};

export const updateMaintenanceCycle = async (id, data, actorUser) => {
    ensureAuthorized(actorUser);
    const validated = schema.updateCycleSchema.parse(data);
    if (validated.defaultChecklistTemplateId) {
        await getActiveChecklistTemplate(validated.defaultChecklistTemplateId);
    }

    const cycle = await repo.updateCycleConfig(id, validated);

    await auditRepo.createAuditLog({
        action: 'MAINTENANCE_CYCLE:UPDATE',
        actorUserId: actorUser.id,
        entityType: 'MaintenanceCycleConfig',
        entityId: cycle.id,
        metadata: { changes: Object.keys(validated) }
    });

    return normalizeCycleConfig(cycle);
};

export const getMaintenanceCycles = async (includeInactive = false) => {
    const cycles = await repo.getAllCycleConfigs(includeInactive);
    return normalizeCycleConfigList(cycles);
};

export const getMaintenanceCycleById = async (id) => {
    const cycle = await repo.getCycleConfigById(id);
    return normalizeCycleConfig(cycle);
};

export const deactivateMaintenanceCycle = async (id, actorUser) => {
    ensureAuthorized(actorUser);

    const cycle = await repo.deleteCycleConfig(id);

    await auditRepo.createAuditLog({
        action: 'MAINTENANCE_CYCLE:DEACTIVATE',
        actorUserId: actorUser.id,
        entityType: 'MaintenanceCycleConfig',
        entityId: cycle.id,
        metadata: { name: cycle.name }
    });

    return normalizeCycleConfig(cycle);
};

// Window Management
export const createMaintenanceWindow = async (data, actorUser) => {
    ensureAuthorized(actorUser);
    const validated = schema.createWindowSchema.parse(data);
    validateWindowDateRange(validated.scheduledStartDate, validated.scheduledEndDate);
    const cycle = await getCycleOr404(validated.cycleConfigId);
    await assertNoWindowOverlap(validated.cycleConfigId, validated.scheduledStartDate, validated.scheduledEndDate);

    const checklistTemplateId = resolveWindowChecklistTemplateId(cycle, validated.checklistTemplateId);
    const checklistData = await buildWindowChecklistData(checklistTemplateId);

    // Use specific repo method for device types
    const window = await repo.createMaintenanceWindowWithDeviceTypes(actorUser.id, {
        ...validated,
        ...checklistData,
        status: 'SCHEDULED',
        scheduledStartDate: new Date(validated.scheduledStartDate),
        scheduledEndDate: validated.scheduledEndDate ? new Date(validated.scheduledEndDate) : null,
        // deviceTypes is in validated
    });

    await auditRepo.createAuditLog({
        action: 'MAINTENANCE_WINDOW:CREATE',
        actorUserId: actorUser.id,
        entityType: 'MaintenanceWindow',
        entityId: window.id,
        metadata: {
            cycleConfigId: window.cycleConfigId,
            date: window.scheduledStartDate,
            deviceTypes: validated.deviceTypes
        }
    });

    emitMaintenanceStatusChanged(window, null, actorUser);

    return normalizeWindowDeviceTypes(window);
};

export const updateMaintenanceWindow = async (id, data, actorUser) => {
    ensureAuthorized(actorUser);
    if (data && Object.prototype.hasOwnProperty.call(data, 'status')) {
        const error = new Error('Status cannot be changed via window update endpoint');
        error.statusCode = 400;
        error.type = '/problems/invalid-window-status-update';
        throw error;
    }
    const validated = schema.updateWindowSchema.parse(data);
    const hasScheduledEndDate = Object.prototype.hasOwnProperty.call(validated, 'scheduledEndDate');

    const updateData = {
        ...validated,
        ...(validated.scheduledStartDate && { scheduledStartDate: new Date(validated.scheduledStartDate) }),
        ...(hasScheduledEndDate && {
            scheduledEndDate: validated.scheduledEndDate ? new Date(validated.scheduledEndDate) : null
        })
    };
    delete updateData.deviceTypes;

    const existingWindow = await repo.getMaintenanceWindowById(id);
    if (!existingWindow) {
        const error = new Error('Maintenance window not found');
        error.statusCode = 404;
        throw error;
    }

    const nextStart = validated.scheduledStartDate ?? existingWindow.scheduledStartDate.toISOString();
    const nextEnd = hasScheduledEndDate
        ? (validated.scheduledEndDate ? new Date(validated.scheduledEndDate).toISOString() : null)
        : (existingWindow.scheduledEndDate?.toISOString() ?? null);
    validateWindowDateRange(nextStart, nextEnd);
    await assertNoWindowOverlap(existingWindow.cycleConfigId, nextStart, nextEnd, id);

    if (validated.checklistTemplateId) {
        Object.assign(updateData, await buildWindowChecklistData(validated.checklistTemplateId));
    }

    // Transaction for atomic update
    const window = await prisma.$transaction(async (tx) => {
        await repo.updateMaintenanceWindow(id, updateData, tx);

        if (validated.deviceTypes) {
            await repo.updateWindowDeviceTypes(id, validated.deviceTypes, tx);
        }

        return repo.getMaintenanceWindowById(id, { includeAssignment: true }, tx);
    });

    await auditRepo.createAuditLog({
        action: 'MAINTENANCE_WINDOW:UPDATE',
        actorUserId: actorUser.id,
        entityType: 'MaintenanceWindow',
        entityId: window.id,
        metadata: { changes: Object.keys(validated) }
    });

    emitMaintenanceStatusChanged(window, existingWindow.status, actorUser);

    return normalizeWindowDeviceTypes(window);
};

export const cancelMaintenanceWindow = async (id, reason, actorUser) => {
    ensureAuthorized(actorUser);
    schema.cancelWindowSchema.parse({ reason });
    const existingWindow = await repo.getMaintenanceWindowById(id);
    if (!existingWindow) {
        const error = new Error('Maintenance window not found');
        error.statusCode = 404;
        throw error;
    }

    let window;
    try {
        window = await repo.updateWindowStatus(id, 'CANCELLED');
    } catch (e) {
        if (e.code === 'P2025') {
            const error = new Error('Maintenance window not found');
            error.statusCode = 404;
            throw error;
        }
        throw e;
    }

    await auditRepo.createAuditLog({
        action: 'MAINTENANCE_WINDOW:CANCEL',
        actorUserId: actorUser.id,
        entityType: 'MaintenanceWindow',
        entityId: window.id,
        metadata: { reason }
    });

    emitMaintenanceStatusChanged(window, existingWindow.status, actorUser);

    return window;
};

export const getMaintenanceWindows = async (filters, actorUser) => {
    // Ensure actorUser is provided (even if just for tracking/context later)
    // No strict RBAC for viewing implied, but good to have user context
    const validated = schema.listWindowsQuerySchema.parse(filters);

    const result = await repo.listMaintenanceWindows({
        ...validated,
        limit: validated.perPage
    });
    return normalizeWindowListResult(result);
};

export const getMaintenanceWindowById = async (id) => {
    const window = await repo.getMaintenanceWindowById(id, { includeChecklist: true, includeAssignment: true, includeCompletion: true });
    return normalizeWindowDeviceTypes(window);
};

// Schedule Generation
export const generateScheduleForCycle = async (cycleConfigId, actorUser, options = {}) => {
    ensureAuthorized(actorUser);
    const { monthsAhead, department } = schema.generateScheduleSchema.parse(options);

    // Check if cycle exists
    const cycle = await repo.getCycleConfigById(cycleConfigId);
    if (!cycle) {
        const error = new Error('Cycle not found');
        error.statusCode = 404;
        throw error;
    }

    const windows = await scheduler.generateFutureWindows(cycleConfigId, monthsAhead, actorUser.id, department);

    await auditRepo.createAuditLog({
        action: 'MAINTENANCE_SCHEDULE:GENERATE',
        actorUserId: actorUser.id,
        entityType: 'MaintenanceCycleConfig',
        entityId: cycleConfigId,
        metadata: { generatedCount: windows.length, monthsAhead }
    });

    return {
        cycleId: cycleConfigId,
        generated: windows.length,
        windows
    };
};

export const regenerateAllSchedules = async (actorUser) => {
    ensureAuthorized(actorUser);

    const cycles = await repo.getAllCycleConfigs(false); // active only
    const results = [];

    for (const cycle of cycles) {
        // We catch errors per cycle to ensure partial success? 
        // Or fail all? 
        // Usually robust regeneration tries all.
        try {
            const result = await generateScheduleForCycle(cycle.id, actorUser);
            results.push(result);
        } catch (error) {
            console.error(`Failed to generate schedule for cycle ${cycle.id}`, error);
            results.push({ cycleId: cycle.id, error: error.message });
        }
    }

    return results;
};

// Checklist Management
export const createChecklistTemplate = async (data, actorUser) => {
    ensureAuthorized(actorUser);
    const validated = schema.createChecklistTemplateSchema.parse(data);

    try {
        const template = await repo.createChecklistTemplate(validated);

        await auditRepo.createAuditLog({
            action: 'MAINTENANCE_CHECKLIST:CREATE',
            actorUserId: actorUser.id,
            entityType: 'MaintenanceChecklistTemplate',
            entityId: template.id,
            metadata: { name: template.name, itemCount: template.items.length }
        });

        return template;
    } catch (e) {
        if (e.code === 'P2002') {
            const error = new Error('Checklist template with this name already exists');
            error.statusCode = 409;
            throw error;
        }
        throw e;
    }
};

export const updateChecklistTemplate = async (id, data, actorUser) => {
    ensureAuthorized(actorUser);
    const validated = schema.updateChecklistTemplateSchema.parse(data);

    try {
        const preUpdateSnapshot = await repo.getChecklistSnapshotByTemplateId(id);
        if (preUpdateSnapshot) {
            const windowsWithoutSnapshot = await prisma.maintenanceWindow.findMany({
                where: { checklistTemplateId: id },
                select: { id: true, checklistSnapshot: true }
            });
            const targetWindowIds = windowsWithoutSnapshot
                .filter((window) => window.checklistSnapshot == null)
                .map((window) => window.id);

            if (targetWindowIds.length > 0) {
                await prisma.maintenanceWindow.updateMany({
                    where: { id: { in: targetWindowIds } },
                    data: {
                        checklistVersion: preUpdateSnapshot.version,
                        checklistSnapshot: preUpdateSnapshot
                    }
                });
            }
        }

        const template = await repo.updateChecklistTemplate(id, validated);

        await auditRepo.createAuditLog({
            action: 'MAINTENANCE_CHECKLIST:UPDATE',
            actorUserId: actorUser.id,
            entityType: 'MaintenanceChecklistTemplate',
            entityId: template.id,
            metadata: { changes: Object.keys(validated), newVersion: template.version }
        });

        return template;
    } catch (e) {
        if (e.code === 'P2002') {
            const error = new Error('Checklist template with this name already exists');
            error.statusCode = 409;
            throw error;
        }
        if (e.code === 'P2025') {
            const error = new Error('Template not found');
            error.statusCode = 404;
            throw error;
        }
        throw e;
    }
};

export const getChecklistTemplates = async (includeInactive = false) => {
    return repo.getAllChecklistTemplates(includeInactive);
};

export const getChecklistTemplateById = async (id) => {
    return repo.getChecklistTemplateById(id);
};

export const deactivateChecklistTemplate = async (id, actorUser) => {
    ensureAuthorized(actorUser);

    try {
        const template = await repo.deactivateChecklistTemplate(id);

        await auditRepo.createAuditLog({
            action: 'MAINTENANCE_CHECKLIST:DEACTIVATE',
            actorUserId: actorUser.id,
            entityType: 'MaintenanceChecklistTemplate',
            entityId: template.id,
            metadata: { name: template.name }
        });

        return template;
    } catch (e) {
        if (e.code === 'P2025') {
            const error = new Error('Template not found');
            error.statusCode = 404;
            throw error;
        }
        throw e;
    }
};

export const attachChecklistToCycle = async (cycleId, checklistTemplateId, actorUser, options = {}) => {
    ensureAuthorized(actorUser);
    await getActiveChecklistTemplate(checklistTemplateId);

    const cycle = await repo.updateCycleConfig(cycleId, { defaultChecklistTemplateId: checklistTemplateId });
    if (!options.skipAudit) {
        await auditRepo.createAuditLog({
            action: 'MAINTENANCE_CYCLE:ATTACH_CHECKLIST',
            actorUserId: actorUser.id,
            entityType: 'MaintenanceCycleConfig',
            entityId: cycle.id,
            metadata: { checklistTemplateId }
        });
    }
    return cycle;
};

// Department Assignment Rule Management

export const createDepartmentAssignmentRule = async (data, actorUser) => {
    ensureAuthorized(actorUser);
    const validated = schema.createAssignmentRuleSchema.parse(data);

    // Validate technicians are active users
    const users = await prisma.user.findMany({
        where: { id: { in: validated.technicianIds } }
    });

    const validation = assignmentService.validateAssignmentRule(validated, users);
    if (!validation.valid) {
        const error = new Error(validation.errors.join('; '));
        error.statusCode = 400;
        error.type = '/problems/invalid-assignment-rule';
        error.validation = validation.errors;
        throw error;
    }

    try {
        const rule = await repo.createAssignmentRule(validated);

        await auditRepo.createAuditLog({
            action: 'MAINTENANCE_ASSIGNMENT_RULE:CREATE',
            actorUserId: actorUser.id,
            entityType: 'DepartmentAssignmentRule',
            entityId: rule.id,
            metadata: {
                department: rule.department,
                strategy: rule.assignmentStrategy,
                technicianCount: validated.technicianIds.length
            }
        });

        return rule;
    } catch (e) {
        if (e.code === 'P2002') {
            const error = new Error('Assignment rule for this department already exists');
            error.statusCode = 409;
            error.type = '/problems/duplicate-department';
            error.department = validated.department;
            throw error;
        }
        throw e;
    }
};

export const updateDepartmentAssignmentRule = async (id, data, actorUser) => {
    ensureAuthorized(actorUser);
    const validated = schema.updateAssignmentRuleSchema.parse(data);

    // If technicians are being updated, validate them
    if (validated.technicianIds) {
        const users = await prisma.user.findMany({
            where: { id: { in: validated.technicianIds } }
        });

        const validation = assignmentService.validateAssignmentRule(
            { ...validated, department: 'temp' }, // Department not needed for validation here
            users
        );

        if (!validation.valid) {
            const error = new Error(validation.errors.join('; '));
            error.statusCode = 400;
            error.type = '/problems/invalid-assignment-rule';
            error.validation = validation.errors;
            throw error;
        }
    }

    try {
        const rule = await repo.updateAssignmentRule(id, validated);

        await auditRepo.createAuditLog({
            action: 'MAINTENANCE_ASSIGNMENT_RULE:UPDATE',
            actorUserId: actorUser.id,
            entityType: 'DepartmentAssignmentRule',
            entityId: rule.id,
            metadata: { changes: Object.keys(validated) }
        });

        return rule;
    } catch (e) {
        if (e.code === 'P2025') {
            const error = new Error('Assignment rule not found');
            error.statusCode = 404;
            throw error;
        }
        if (e.code === 'P2002') {
            const error = new Error('Assignment rule for this department already exists');
            error.statusCode = 409;
            throw error;
        }
        throw e;
    }
};

export const getDepartmentAssignmentRules = async (includeInactive = false) => {
    return repo.getAllAssignmentRules(includeInactive, true);
};

export const getDepartmentAssignmentRuleById = async (id) => {
    const rule = await repo.getAssignmentRuleById(id, true);
    if (!rule) {
        const error = new Error('Assignment rule not found');
        error.statusCode = 404;
        throw error;
    }
    return rule;
};

export const deactivateDepartmentAssignmentRule = async (id, actorUser) => {
    ensureAuthorized(actorUser);

    try {
        const rule = await repo.deactivateAssignmentRule(id);

        await auditRepo.createAuditLog({
            action: 'MAINTENANCE_ASSIGNMENT_RULE:DEACTIVATE',
            actorUserId: actorUser.id,
            entityType: 'DepartmentAssignmentRule',
            entityId: rule.id,
            metadata: { department: rule.department }
        });

        return rule;
    } catch (e) {
        if (e.code === 'P2025') {
            const error = new Error('Assignment rule not found');
            error.statusCode = 404;
            throw error;
        }
        throw e;
    }
};

// Manual Assignment
export const manuallyAssignMaintenanceWindow = async (windowId, userId, actorUser) => {
    ensureAuthorized(actorUser);
    schema.manualAssignSchema.parse({ userId });

    // Validate user exists and is active 
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }
    if (user.status !== 'active') {
        const error = new Error('Cannot assign to inactive user');
        error.statusCode = 400;
        throw error;
    }

    const window = await repo.assignMaintenanceWindow(windowId, userId, 'manual-override');

    await auditRepo.createAuditLog({
        action: 'MAINTENANCE_WINDOW:MANUAL_ASSIGN',
        actorUserId: actorUser.id,
        entityType: 'MaintenanceWindow',
        entityId: windowId,
        metadata: {
            assignedToId: userId,
            assignedToUsername: user.username
        }
    });

    return window;
};

// Rotation Management
export const resetDepartmentRotation = async (ruleId, actorUser) => {
    ensureAuthorized(actorUser);

    const rotationState = await repo.resetRotationState(ruleId);

    await auditRepo.createAuditLog({
        action: 'MAINTENANCE_ASSIGNMENT_RULE:RESET_ROTATION',
        actorUserId: actorUser.id,
        entityType: 'DepartmentAssignmentRule',
        entityId: ruleId,
        metadata: {}
    });

    return rotationState;
};

// Get assigned windows
export const getMyMaintenanceWindows = async (userId, filters = {}) => {
    const validated = schema.getMyTasksQuerySchema.parse(filters);
    const status = validated.status ?? ['SCHEDULED', 'UPCOMING', 'OVERDUE'];
    const result = await repo.getMaintenanceWindowsByAssignee(userId, {
        ...validated,
        status
    });
    return normalizeWindowListResult(result);
};

const makeProblemError = ({ statusCode, type, message, extensions = {} }) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.type = type;
    Object.assign(error, extensions);
    return error;
};

// Maintenance Completion
export const validateSignOffEligibility = async (windowId, userId, userRole) => {
    const window = await repo.getMaintenanceWindowById(windowId, {
        includeAssignment: true,
        includeCompletion: true,
        includeChecklist: true
    });

    if (!window) {
        return {
            valid: false,
            statusCode: 404,
            type: '/problems/window-not-found',
            reason: 'Maintenance window not found'
        };
    }

    if (window.status === 'COMPLETED') {
        return {
            valid: false,
            statusCode: 409,
            type: '/problems/window-already-completed',
            reason: 'Window already completed'
        };
    }

    if (window.status === 'CANCELLED') {
        return {
            valid: false,
            statusCode: 409,
            type: '/problems/invalid-window-status',
            reason: 'Cannot sign off a cancelled maintenance window'
        };
    }

    // Check assignment
    const isAssigned = window.assignedToId === userId;
    const hasPrivilegedRole = ['it', 'admin', 'head_it'].includes(userRole);

    if (!isAssigned && !hasPrivilegedRole) {
        return {
            valid: false,
            statusCode: 403,
            type: '/problems/window-not-assigned',
            reason: 'User is not assigned to this maintenance window'
        };
    }

    return {
        valid: true,
        window,
        isAssigned,
        hasPrivilegedRole,
        windowStatus: window.status,
        reason: isAssigned ? 'User is assigned to this window' : 'User has IT/Admin/Head privileges'
    };
};

export const getSignOffEligibility = async (windowId, actorUser) => {
    ensureAuthenticated(actorUser);

    const eligibility = await validateSignOffEligibility(windowId, actorUser.id, actorUser.role);
    if (!eligibility.valid && eligibility.statusCode === 404) {
        throw makeProblemError({
            statusCode: 404,
            type: eligibility.type,
            message: eligibility.reason
        });
    }

    const requiredItems = getChecklistItemsForWindow(eligibility.window).filter((item) => item.isRequired);
    const noRequiredItems = requiredItems.length === 0;

    return {
        canSignOff: eligibility.valid,
        reason: eligibility.reason,
        requiredItemsCompleted: noRequiredItems ? true : null,
        incompleteRequiredItems: [],
        requiredItemsCount: requiredItems.length,
        windowStatus: eligibility.windowStatus ?? eligibility.window?.status ?? null
    };
};

export const signOffMaintenanceWindow = async (windowId, userId, data, actorUser) => {
    ensureAuthenticated(actorUser);

    const { completedItems, notes, assistedSigner } = schema.signOffSchema.parse(data);
    const signoffMode = assistedSigner ? 'ASSISTED' : 'STANDARD';
    const signerName = assistedSigner?.name?.trim() || null;
    const signerConfirmedAt = assistedSigner ? new Date() : null;
    let signerSignatureUrl = null;

    // 1. Check eligibility
    const eligibility = await validateSignOffEligibility(windowId, userId, actorUser.role);
    if (!eligibility.valid) {
        throw makeProblemError({
            statusCode: eligibility.statusCode ?? 403,
            type: eligibility.type,
            message: eligibility.reason
        });
    }

    const checklistItems = getChecklistItemsForWindow(eligibility.window);
    const requiredChecklistItems = checklistItems.filter((item) => item.isRequired);

    const completionByItemId = new Map(
        completedItems.map((item) => [item.checklistItemId, item])
    );

    const incompleteRequiredItems = requiredChecklistItems
        .filter((item) => !completionByItemId.get(item.id)?.isCompleted)
        .map((item) => ({ itemId: item.id, itemTitle: item.title }));

    if (incompleteRequiredItems.length > 0) {
        throw makeProblemError({
            statusCode: 400,
            type: '/problems/required-items-incomplete',
            message: 'All required checklist items must be completed before sign-off',
            extensions: { incompleteRequiredItems }
        });
    }

    const checklistItemIdSet = new Set(checklistItems.map((item) => item.id));
    const unknownSubmittedItems = completedItems
        .filter((item) => !checklistItemIdSet.has(item.checklistItemId))
        .map((item) => item.checklistItemId);

    if (unknownSubmittedItems.length > 0) {
        throw makeProblemError({
            statusCode: 400,
            type: '/problems/invalid-checklist-items',
            message: 'Sign-off payload contains checklist items that are not attached to this window',
            extensions: { unknownChecklistItemIds: unknownSubmittedItems }
        });
    }

    // 2. Create completion
    try {
        if (assistedSigner?.signatureDataUrl) {
            signerSignatureUrl = await saveAssistedSignature(windowId, assistedSigner.signatureDataUrl);
        }

        const completion = await repo.createCompletion(
            windowId,
            userId,
            notes,
            completedItems,
            {
                signerName,
                signerSignatureUrl,
                signerConfirmedAt,
                signoffMode
            }
        );

        // 3. Audit Log
        await auditRepo.createAuditLog({
            action: 'MAINTENANCE_WINDOW:COMPLETE',
            actorUserId: userId,
            entityType: 'MaintenanceWindow',
            entityId: windowId,
            metadata: {
                completionId: completion.id,
                itemCount: completedItems.length,
                deviceTypes: completion.deviceTypes,
                signoffMode,
                signerName,
                signerConfirmedAt
            }
        });

        // 4. Emit Event
        domainEvents.emit('maintenance.window_completed', {
            windowId,
            completedById: userId,
            timestamp: completion.completedAt,
            completionId: completion.id,
            signoffMode,
            signerName,
            signerConfirmedAt
        });

        emitMaintenanceCompleted({
            id: windowId,
            assignedToId: eligibility.window.assignedToId,
            completedAt: completion.completedAt,
            completionRemarks: notes,
            status: 'COMPLETED',
            signoffMode,
            signerName,
            signerConfirmedAt
        }, actorUser);

        return normalizeCompletionDeviceTypes(completion);
    } catch (e) {
        if (signerSignatureUrl) {
            const fileName = signerSignatureUrl.split('/').pop();
            if (fileName) {
                await deleteFile(fileName).catch(() => { });
            }
        }

        if (e.code === 'P2002') {
            throw makeProblemError({
                statusCode: 409,
                type: '/problems/window-already-completed',
                message: 'Maintenance window already completed'
            });
        }
        throw e;
    }
};

export const getMaintenanceCompletion = async (windowId, actorUser) => {
    ensureAuthenticated(actorUser);

    const completion = await repo.getCompletionByWindowId(windowId);
    if (!completion) {
        const error = new Error('Completion record not found');
        error.statusCode = 404;
        throw error;
    }
    return normalizeCompletionDeviceTypes(completion);
};

export const getCompletionHistory = async (userId, filters, actorUser) => {
    ensureAuthenticated(actorUser);

    // Users can only see their own history unless admin/head_it
    if (userId !== actorUser.id && !['admin', 'head_it'].includes(actorUser.role)) {
        const error = new Error('Unauthorized access to completion history');
        error.statusCode = 403;
        throw error;
    }

    const validatedCallback = schema.getCompletionHistorySearchSchema.parse(filters);

    // Map perPage to limit for repo
    const repoFilters = {
        ...validatedCallback,
        limit: validatedCallback.perPage
    };

    const result = await repo.getCompletionsByUserId(userId, repoFilters);
    return normalizeCompletionListResult(result);
};

export const getMyCompletionHistory = async (filters, actorUser) => {
    return getCompletionHistory(actorUser.id, filters, actorUser);
};
