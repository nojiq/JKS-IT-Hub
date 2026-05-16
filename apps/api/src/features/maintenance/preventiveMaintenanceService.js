import { prisma } from '../../shared/db/prisma.js';
import {
    completeMaintenanceRun,
    startMaintenanceRun,
    updateMaintenanceRunItem
} from './preventiveRunService.js';
import {
    createAssignmentSchema,
    createProfileSchema,
    listRunsQuerySchema,
    saveProfileChecklistSchema,
    updateProfileSchema,
    updateRunItemSchema
} from './preventiveSchema.js';

const OPEN_RUN_STATUSES = ['scheduled', 'due', 'in_progress', 'overdue'];
const TERMINAL_RUN_STATUSES = ['completed', 'cancelled', 'skipped'];
const ADMIN_ROLES = new Set(['dev', 'admin', 'head_it']);

const notFound = (message) => {
    const error = new Error(message);
    error.statusCode = 404;
    return error;
};

const forbidden = (message = 'Forbidden') => {
    const error = new Error(message);
    error.statusCode = 403;
    return error;
};

export const assertMaintenanceAdmin = (actor) => {
    if (!ADMIN_ROLES.has(actor?.role)) {
        throw forbidden('Maintenance administration requires an admin role.');
    }
};

const mapUserSummary = (user) => {
    if (!user) return null;
    return {
        id: user.id,
        username: user.username,
        displayName: user.username
    };
};

const mapAssetSummary = (asset) => {
    if (!asset) return null;
    return {
        id: asset.id,
        assetTag: asset.assetTag,
        name: asset.name,
        categoryName: asset.categoryName,
        statusLabel: asset.statusLabel
    };
};

const mapProfileSummary = (profile) => {
    if (!profile) return null;
    return {
        id: profile.id,
        name: profile.name,
        description: profile.description,
        intervalMonths: profile.intervalMonths,
        gracePeriodDays: profile.gracePeriodDays,
        isActive: profile.isActive,
        activeTemplateId: profile.activeTemplateId
    };
};

const mapRunItem = (item) => ({
    id: item.id,
    checklistItemId: item.checklistItemId,
    sortOrder: item.sortOrder,
    title: item.title,
    description: item.description,
    required: item.required,
    evidenceRequired: item.evidenceRequired,
    status: item.status,
    notes: item.notes,
    evidenceUrl: item.evidenceUrl,
    completedAt: item.completedAt,
    completedBy: mapUserSummary(item.completedBy)
});

export const mapMaintenanceRun = (run) => ({
    id: run.id,
    userId: run.userId,
    status: run.status,
    dueDate: run.dueDate,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    cancelledAt: run.cancelledAt,
    skippedAt: run.skippedAt,
    asset: mapAssetSummary(run.asset),
    profile: mapProfileSummary(run.profile),
    assignedTo: mapUserSummary(run.user),
    completedBy: mapUserSummary(run.completedBy),
    items: (run.items || []).map(mapRunItem).sort((a, b) => a.sortOrder - b.sortOrder),
    checklistSnapshot: run.checklistSnapshot
});

const runInclude = {
    asset: true,
    profile: true,
    user: true,
    completedBy: true,
    items: {
        orderBy: { sortOrder: 'asc' },
        include: { completedBy: true }
    }
};

export const listMaintenanceProfiles = async (includeInactive = false) => {
    const profiles = await prisma.maintenanceProfile.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: { name: 'asc' },
        include: {
            activeTemplate: {
                include: {
                    items: { orderBy: { sortOrder: 'asc' } }
                }
            }
        }
    });

    return profiles.map((profile) => ({
        ...mapProfileSummary(profile),
        checklistTemplate: profile.activeTemplate
            ? {
                id: profile.activeTemplate.id,
                name: profile.activeTemplate.name,
                version: profile.activeTemplate.version,
                items: profile.activeTemplate.items
            }
            : null
    }));
};

export const createMaintenanceProfile = async (data, actor) => {
    assertMaintenanceAdmin(actor);
    const payload = createProfileSchema.parse(data);

    return prisma.$transaction(async (tx) => {
        const profile = await tx.maintenanceProfile.create({
            data: {
                name: payload.name,
                description: payload.description,
                intervalMonths: payload.intervalMonths,
                gracePeriodDays: payload.gracePeriodDays ?? 0
            }
        });

        const template = await tx.checklistTemplate.create({
            data: {
                profileId: profile.id,
                name: `${payload.name} checklist`,
                version: 1,
                items: {
                    create: payload.checklistItems.map((item, index) => ({
                        sortOrder: index,
                        title: item.title,
                        description: item.description,
                        required: item.required ?? true,
                        evidenceRequired: item.evidenceRequired ?? false
                    }))
                }
            },
            include: { items: { orderBy: { sortOrder: 'asc' } } }
        });

        await tx.maintenanceProfile.update({
            where: { id: profile.id },
            data: { activeTemplateId: template.id }
        });

        return {
            ...mapProfileSummary(profile),
            activeTemplateId: template.id,
            checklistTemplate: {
                id: template.id,
                name: template.name,
                version: template.version,
                items: template.items
            }
        };
    });
};

export const updateMaintenanceProfile = async (profileId, data, actor) => {
    assertMaintenanceAdmin(actor);
    const payload = updateProfileSchema.parse(data);
    const profile = await prisma.maintenanceProfile.update({
        where: { id: profileId },
        data: payload
    });
    return mapProfileSummary(profile);
};

export const saveProfileChecklist = async (profileId, data, actor) => {
    assertMaintenanceAdmin(actor);
    const payload = saveProfileChecklistSchema.parse(data);

    return prisma.$transaction(async (tx) => {
        const profile = await tx.maintenanceProfile.findUnique({ where: { id: profileId } });
        if (!profile) throw notFound('Maintenance profile not found');

        const latest = await tx.checklistTemplate.findFirst({
            where: { profileId },
            orderBy: { version: 'desc' }
        });
        const nextVersion = (latest?.version ?? 0) + 1;

        const template = await tx.checklistTemplate.create({
            data: {
                profileId,
                name: `${profile.name} checklist v${nextVersion}`,
                version: nextVersion,
                items: {
                    create: payload.items.map((item, index) => ({
                        sortOrder: index,
                        title: item.title,
                        description: item.description,
                        required: item.required ?? true,
                        evidenceRequired: item.evidenceRequired ?? false
                    }))
                }
            },
            include: { items: { orderBy: { sortOrder: 'asc' } } }
        });

        await tx.maintenanceProfile.update({
            where: { id: profileId },
            data: { activeTemplateId: template.id }
        });

        return {
            id: template.id,
            name: template.name,
            version: template.version,
            items: template.items
        };
    });
};

export const listMaintenanceAssignments = async () => {
    const assignments = await prisma.maintenanceAssignment.findMany({
        where: { status: 'active' },
        include: {
            asset: true,
            profile: true,
            user: true,
            runs: {
                where: { status: { in: OPEN_RUN_STATUSES } },
                orderBy: { dueDate: 'asc' },
                take: 1
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return assignments.map((assignment) => {
        const nextRun = assignment.runs[0] ?? null;
        return {
            id: assignment.id,
            asset: mapAssetSummary(assignment.asset),
            profile: mapProfileSummary(assignment.profile),
            technician: mapUserSummary(assignment.user),
            startDate: assignment.startDate,
            nextRun: nextRun
                ? {
                    id: nextRun.id,
                    dueDate: nextRun.dueDate,
                    status: nextRun.status
                }
                : null
        };
    });
};

export const createMaintenanceAssignment = async (data, actor) => {
    assertMaintenanceAdmin(actor);
    const payload = createAssignmentSchema.parse(data);
    const startDate = payload.startDate ? new Date(payload.startDate) : new Date();

    const asset = await prisma.asset.findUnique({ where: { id: payload.assetId } });
    if (!asset) throw notFound('Asset not found');

    const profile = await prisma.maintenanceProfile.findUnique({ where: { id: payload.profileId } });
    if (!profile?.isActive) throw notFound('Maintenance profile not found or inactive');

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.status === 'disabled') throw notFound('Technician not found');

    const existing = await prisma.maintenanceAssignment.findFirst({
        where: {
            assetId: payload.assetId,
            profileId: payload.profileId,
            status: 'active'
        }
    });
    if (existing) {
        const error = new Error('An active assignment already exists for this asset and policy.');
        error.statusCode = 409;
        throw error;
    }

    const assignment = await prisma.maintenanceAssignment.create({
        data: {
            profileId: payload.profileId,
            assetId: payload.assetId,
            userId: payload.userId,
            status: 'active',
            startDate,
            activeKey: `${payload.assetId}:${payload.profileId}`
        },
        include: { asset: true, profile: true, user: true }
    });

    return {
        id: assignment.id,
        asset: mapAssetSummary(assignment.asset),
        profile: mapProfileSummary(assignment.profile),
        technician: mapUserSummary(assignment.user),
        startDate: assignment.startDate,
        nextRun: null
    };
};

const buildRunsWhere = (query, actor, { mine = false, history = false } = {}) => {
    const parsed = listRunsQuerySchema.parse(query);
    const where = {};

    if (mine) {
        where.userId = actor.id;
        where.status = { in: OPEN_RUN_STATUSES };
    } else if (history) {
        where.status = { in: TERMINAL_RUN_STATUSES };
    }

    if (parsed.status) {
        where.status = Array.isArray(parsed.status) ? { in: parsed.status } : parsed.status;
    }
    if (parsed.assetId) where.assetId = parsed.assetId;
    if (parsed.userId) where.userId = parsed.userId;
    if (parsed.startDate || parsed.endDate) {
        where.dueDate = {};
        if (parsed.startDate) where.dueDate.gte = new Date(parsed.startDate);
        if (parsed.endDate) where.dueDate.lte = new Date(parsed.endDate);
    }

    return { parsed, where };
};

const urgencyRank = { overdue: 0, due: 1, in_progress: 2, scheduled: 3 };

export const listTechnicianRuns = async (actor, query = {}) => {
    const { parsed, where } = buildRunsWhere(query, actor, { mine: true });

    const [total, runs] = await Promise.all([
        prisma.maintenanceRun.count({ where }),
        prisma.maintenanceRun.findMany({
            where,
            include: runInclude,
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
            skip: (parsed.page - 1) * parsed.perPage,
            take: parsed.perPage
        })
    ]);

    const data = runs
        .map(mapMaintenanceRun)
        .sort((a, b) => (urgencyRank[a.status] ?? 9) - (urgencyRank[b.status] ?? 9));

    return {
        data,
        meta: {
            total,
            page: parsed.page,
            perPage: parsed.perPage,
            totalPages: Math.max(1, Math.ceil(total / parsed.perPage))
        }
    };
};

export const listMaintenanceRunHistory = async (actor, query = {}) => {
    const { parsed, where } = buildRunsWhere(query, actor, { history: true });

    if (parsed.search) {
        const term = parsed.search.trim();
        where.OR = [
            { asset: { assetTag: { contains: term } } },
            { asset: { name: { contains: term } } },
            { profile: { name: { contains: term } } },
            { user: { username: { contains: term } } }
        ];
    }

    const [total, runs] = await Promise.all([
        prisma.maintenanceRun.count({ where }),
        prisma.maintenanceRun.findMany({
            where,
            include: runInclude,
            orderBy: [{ completedAt: 'desc' }, { dueDate: 'desc' }],
            skip: (parsed.page - 1) * parsed.perPage,
            take: parsed.perPage
        })
    ]);

    return {
        data: runs.map(mapMaintenanceRun),
        meta: {
            total,
            page: parsed.page,
            perPage: parsed.perPage,
            totalPages: Math.max(1, Math.ceil(total / parsed.perPage))
        }
    };
};

export const getMaintenanceRun = async (runId, actor) => {
    const run = await prisma.maintenanceRun.findUnique({
        where: { id: runId },
        include: runInclude
    });
    if (!run) throw notFound('Maintenance run not found');

    const isOwner = run.userId === actor.id;
    const isAdmin = ADMIN_ROLES.has(actor.role);
    if (!isOwner && !isAdmin && !TERMINAL_RUN_STATUSES.includes(run.status)) {
        throw forbidden();
    }

    return mapMaintenanceRun(run);
};

export const startRun = async (runId, actor) => {
    const run = await getMaintenanceRun(runId, actor);
    if (run.userId && run.userId !== actor.id && !ADMIN_ROLES.has(actor.role)) {
        throw forbidden('This maintenance run is assigned to another technician.');
    }

    const updated = await startMaintenanceRun(runId, actor.id);
    return getMaintenanceRun(updated.id, actor);
};

export const updateRunItem = async (runItemId, data, actor) => {
    const payload = updateRunItemSchema.parse(data);
    await updateMaintenanceRunItem(runItemId, payload, actor.id);
    const item = await prisma.maintenanceRunItem.findUnique({
        where: { id: runItemId },
        include: { run: true }
    });
    return getMaintenanceRun(item.runId, actor);
};

export const completeRun = async (runId, actor) => {
    await completeMaintenanceRun(runId, actor.id);
    return getMaintenanceRun(runId, actor);
};

const mapAssetAssigneeFields = (asset) => {
    const user = asset?.assignedToUser;
    if (user) {
        const ldap = user.ldapAttributes && typeof user.ldapAttributes === 'object' ? user.ldapAttributes : {};
        const userName =
            ldap.displayName ||
            ldap.cn ||
            ldap.name ||
            user.username ||
            null;
        const department =
            user.orgSnapshot?.department?.name ||
            ldap.department ||
            ldap.departmentName ||
            null;
        return {
            userName: userName ? String(userName).trim() : null,
            department: department ? String(department).trim() : null
        };
    }

    const snipeName = asset?.snipeAssignedName?.trim() || null;
    const snipeUsername = asset?.snipeAssignedUsername?.trim() || null;
    return {
        userName: snipeName || snipeUsername || null,
        department: null
    };
};

export const listAssetsAssignmentMatrix = async () => {
    const [assets, assignments] = await Promise.all([
        prisma.asset.findMany({
            orderBy: { assetTag: 'asc' },
            take: 500,
            include: {
                assignedToUser: {
                    select: {
                        id: true,
                        username: true,
                        ldapAttributes: true,
                        orgSnapshot: true
                    }
                }
            }
        }),
        prisma.maintenanceAssignment.findMany({
            where: { status: 'active' },
            include: {
                profile: true,
                user: true,
                runs: {
                    where: { status: { in: OPEN_RUN_STATUSES } },
                    orderBy: { dueDate: 'asc' },
                    take: 1
                }
            }
        })
    ]);

    const assignmentByAsset = new Map();
    for (const assignment of assignments) {
        assignmentByAsset.set(assignment.assetId, assignment);
    }

    return assets.map((asset) => {
        const assignment = assignmentByAsset.get(asset.id);
        const nextRun = assignment?.runs?.[0] ?? null;
        const assignee = mapAssetAssigneeFields(asset);
        return {
            assetId: asset.id,
            assetTag: asset.assetTag,
            deviceType: asset.categoryName || asset.modelName || '—',
            userName: assignee.userName,
            department: assignee.department,
            assignmentId: assignment?.id ?? null,
            profile: assignment ? mapProfileSummary(assignment.profile) : null,
            technician: assignment ? mapUserSummary(assignment.user) : null,
            nextDueDate: nextRun?.dueDate ?? null,
            status: nextRun?.status ?? (assignment ? 'scheduled' : 'unassigned'),
            runId: nextRun?.id ?? null
        };
    });
};
