import { prisma } from "../../shared/db/prisma.js";

// Maintenance Cycle Config Operations

export const createCycleConfig = async (data, tx = prisma) => {
    return tx.maintenanceCycleConfig.create({
        data,
        include: {
            defaultChecklist: {
                select: {
                    id: true,
                    name: true,
                    version: true,
                    _count: {
                        select: { items: true }
                    }
                }
            }
        }
    });
};

export const updateCycleConfig = async (id, data, tx = prisma) => {
    return tx.maintenanceCycleConfig.update({
        where: { id },
        data,
        include: {
            defaultChecklist: {
                select: {
                    id: true,
                    name: true,
                    version: true,
                    _count: {
                        select: { items: true }
                    }
                }
            }
        }
    });
};

export const getCycleConfigById = async (id, tx = prisma) => {
    return tx.maintenanceCycleConfig.findUnique({
        where: { id },
        include: {
            defaultChecklist: {
                select: {
                    id: true,
                    name: true,
                    version: true,
                    _count: {
                        select: { items: true }
                    }
                }
            }
        }
    });
};

export const getAllCycleConfigs = async (includeInactive = false, tx = prisma) => {
    const where = {};
    if (!includeInactive) {
        where.isActive = true;
    }
    return tx.maintenanceCycleConfig.findMany({
        where,
        include: {
            defaultChecklist: {
                select: {
                    id: true,
                    name: true,
                    version: true,
                    _count: {
                        select: { items: true }
                    }
                }
            }
        },
        orderBy: { name: 'asc' }
    });
};

export const deleteCycleConfig = async (id, tx = prisma) => {
    return tx.maintenanceCycleConfig.update({
        where: { id },
        data: { isActive: false },
        include: {
            defaultChecklist: {
                select: {
                    id: true,
                    name: true,
                    version: true,
                    _count: {
                        select: { items: true }
                    }
                }
            }
        }
    });
};

// Maintenance Window Operations

export const createMaintenanceWindow = async (data, tx = prisma) => {
    return tx.maintenanceWindow.create({ data });
};

export const updateMaintenanceWindow = async (id, data, tx = prisma) => {
    return tx.maintenanceWindow.update({
        where: { id },
        data
    });
};

export const getMaintenanceWindowById = async (id, options = {}, tx = prisma) => {
    // If second argument is a transaction, handle backward compatibility
    if (options && options.$transaction) {
        tx = options;
        options = {};
    }

    const { includeChecklist = false, includeAssignment = false, includeCompletion = false } = options;

    const include = {
        cycleConfig: true,
        createdBy: {
            select: { id: true, username: true } // Minimal user info
        },
        deviceTypes: true
    };

    if (includeChecklist) {
        include.checklist = {
            include: {
                items: {
                    orderBy: { orderIndex: 'asc' }
                }
            }
        };
    }

    if (includeAssignment) {
        include.assignedTo = {
            select: { id: true, username: true }
        };
    }

    if (includeCompletion) {
        include.completion = {
            include: {
                completedBy: {
                    select: { id: true, username: true, role: true }
                },
                checklistItems: true
            }
        };
    }

    return tx.maintenanceWindow.findUnique({
        where: { id },
        include
    });
};

export const findOverlappingMaintenanceWindow = async (
    cycleConfigId,
    scheduledStartDate,
    scheduledEndDate = null,
    excludeWindowId = null,
    tx = prisma
) => {
    const start = new Date(scheduledStartDate);
    const end = scheduledEndDate ? new Date(scheduledEndDate) : start;

    const where = {
        cycleConfigId,
        status: { not: 'CANCELLED' },
        OR: [
            {
                AND: [
                    { scheduledEndDate: null },
                    { scheduledStartDate: { gte: start, lte: end } }
                ]
            },
            {
                AND: [
                    { scheduledEndDate: { not: null } },
                    { scheduledStartDate: { lte: end } },
                    { scheduledEndDate: { gte: start } }
                ]
            }
        ]
    };

    if (excludeWindowId) {
        where.NOT = { id: excludeWindowId };
    }

    return tx.maintenanceWindow.findFirst({ where });
};

export const getMaintenanceWindowsByCycleId = async (cycleConfigId, filters = {}, tx = prisma) => {
    const { status, scheduledStartDateLte, scheduledStartDateLt, scheduledStartDateGte, orderBy, page = 1, limit = 50 } = filters;
    const where = {};

    if (cycleConfigId) {
        where.cycleConfigId = cycleConfigId;
    }

    if (status) {
        if (Array.isArray(status)) {
            where.status = { in: status };
        } else {
            where.status = status;
        }
    }

    if (scheduledStartDateLte) {
        where.scheduledStartDate = { ...where.scheduledStartDate, lte: new Date(scheduledStartDateLte) };
    }
    if (scheduledStartDateLt) {
        where.scheduledStartDate = { ...where.scheduledStartDate, lt: new Date(scheduledStartDateLt) };
    }
    if (scheduledStartDateGte) {
        where.scheduledStartDate = { ...where.scheduledStartDate, gte: new Date(scheduledStartDateGte) };
    }

    if (filters.deviceType) {
        where.deviceTypes = {
            some: { deviceType: filters.deviceType }
        };
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
        tx.maintenanceWindow.findMany({
            where,
            include: {
                cycleConfig: true,
                createdBy: {
                    select: { id: true, username: true }
                },
                deviceTypes: true
            },
            orderBy: orderBy || { scheduledStartDate: 'asc' },
            skip,
            take: limit
        }),
        tx.maintenanceWindow.count({ where })
    ]);

    return {
        data,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

export const getUpcomingMaintenanceWindows = async (limit = 50, tx = prisma) => {
    return tx.maintenanceWindow.findMany({
        where: {
            status: { in: ['SCHEDULED', 'UPCOMING'] },
            scheduledStartDate: { gte: new Date() }
        },
        include: {
            cycleConfig: true,
            createdBy: {
                select: { id: true, username: true }
            }
        },
        orderBy: { scheduledStartDate: 'asc' },
        take: limit
    });
};

export const updateWindowStatus = async (id, status, tx = prisma) => {
    return tx.maintenanceWindow.update({
        where: { id },
        data: { status }
    });
};

export const createMaintenanceWindowWithDeviceTypes = async (userId, data, tx = prisma) => {
    const { deviceTypes, ...windowData } = data;

    const op = async (client) => {
        // Create window
        const window = await client.maintenanceWindow.create({
            data: {
                ...windowData,
                createdById: userId
            }
        });

        // Add device types
        if (deviceTypes && deviceTypes.length > 0) {
            await client.maintenanceWindowDeviceType.createMany({
                data: deviceTypes.map(dt => ({
                    windowId: window.id,
                    deviceType: dt
                }))
            });
        }

        // Return with device types
        return client.maintenanceWindow.findUnique({
            where: { id: window.id },
            include: { deviceTypes: true }
        });
    };

    if (tx === prisma) {
        return tx.$transaction(op);
    } else {
        return op(tx);
    }
};

export const getDeviceTypesForWindow = async (windowId, tx = prisma) => {
    const relations = await tx.maintenanceWindowDeviceType.findMany({
        where: { windowId },
        select: { deviceType: true }
    });
    return relations.map(r => r.deviceType);
};

export const updateWindowDeviceTypes = async (windowId, deviceTypes, tx = prisma) => {
    const op = async (client) => {
        // Delete existing
        await client.maintenanceWindowDeviceType.deleteMany({
            where: { windowId }
        });

        // Create new
        if (deviceTypes && deviceTypes.length > 0) {
            await client.maintenanceWindowDeviceType.createMany({
                data: deviceTypes.map(dt => ({
                    windowId,
                    deviceType: dt
                }))
            });
        }

        return client.maintenanceWindow.findUnique({
            where: { id: windowId },
            include: { deviceTypes: true }
        });
    };

    if (tx === prisma) {
        return tx.$transaction(op);
    } else {
        return op(tx);
    }
};

export const getWindowsByDeviceType = async (deviceType, tx = prisma) => {
    return tx.maintenanceWindow.findMany({
        where: {
            deviceTypes: {
                some: { deviceType }
            }
        },
        include: { deviceTypes: true }
    });
};

export const listMaintenanceWindows = async (filters = {}, tx = prisma) => {
    const {
        cycleId,
        status,
        deviceType,
        startDateFrom,
        startDateTo,
        search,
        assignedTo,
        page = 1,
        limit = 50,
        orderBy
    } = filters;

    const where = {};

    if (cycleId) {
        where.cycleConfigId = cycleId;
    }

    if (status) {
        if (Array.isArray(status)) {
            where.status = { in: status };
        } else {
            where.status = status;
        }
    }

    if (deviceType) {
        where.deviceTypes = {
            some: { deviceType }
        };
    }

    if (startDateFrom) {
        where.scheduledStartDate = { ...where.scheduledStartDate, gte: new Date(startDateFrom) };
    }
    if (startDateTo) {
        where.scheduledStartDate = { ...where.scheduledStartDate, lte: new Date(startDateTo) };
    }

    if (assignedTo) {
        where.assignedToId = assignedTo;
    }

    if (search) {
        const searchUpper = search.toUpperCase();
        const allDeviceTypes = ['LAPTOP', 'DESKTOP_PC', 'SERVER'];
        const matchedDeviceTypes = allDeviceTypes.filter(dt => dt.includes(searchUpper));

        where.OR = [
            { cycleConfig: { name: { contains: search, mode: 'insensitive' } } },
            { assignedTo: { username: { contains: search, mode: 'insensitive' } } }
        ];

        if (matchedDeviceTypes.length > 0) {
            where.OR.push({
                deviceTypes: {
                    some: { deviceType: { in: matchedDeviceTypes } }
                }
            });
        }
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
        tx.maintenanceWindow.findMany({
            where,
            include: {
                deviceTypes: true,
                cycleConfig: true,
                assignedTo: {
                    select: { id: true, username: true }
                },
                createdBy: {
                    select: { id: true, username: true }
                }
            },
            skip,
            take: limit,
            orderBy: orderBy || { scheduledStartDate: 'asc' }
        }),
        tx.maintenanceWindow.count({ where })
    ]);

    return {
        data,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

// Checklist Template Operations

const toChecklistSnapshot = (template) => {
    if (!template) return null;
    return {
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
    };
};

export const getChecklistSnapshotByTemplateId = async (templateId, tx = prisma) => {
    if (!templateId) return null;
    const template = await tx.maintenanceChecklistTemplate.findUnique({
        where: { id: templateId },
        include: {
            items: {
                orderBy: { orderIndex: 'asc' }
            }
        }
    });
    return toChecklistSnapshot(template);
};

export const createChecklistTemplate = async (data, tx = prisma) => {
    return tx.maintenanceChecklistTemplate.create({
        data: {
            name: data.name,
            description: data.description,
            isActive: data.isActive ?? true,
            version: 1,
            items: {
                create: data.items.map((item, index) => ({
                    title: item.title,
                    description: item.description,
                    isRequired: item.isRequired ?? true,
                    orderIndex: index
                }))
            }
        },
        include: {
            items: {
                orderBy: { orderIndex: 'asc' }
            }
        }
    });
};

export const updateChecklistTemplate = async (id, data, tx = prisma) => {
    const updateData = {
        version: { increment: 1 }
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (data.items) {
        // Delete existing items first in a transaction
        // But since we are inside a single update call, we can use deleteMany + create
        updateData.items = {
            deleteMany: {},
            create: data.items.map((item, index) => ({
                title: item.title,
                description: item.description,
                isRequired: item.isRequired ?? true,
                orderIndex: index
            }))
        };
    }

    return tx.maintenanceChecklistTemplate.update({
        where: { id },
        data: updateData,
        include: {
            items: {
                orderBy: { orderIndex: 'asc' }
            }
        }
    });
};

export const getChecklistTemplateById = async (id, includeItems = true, tx = prisma) => {
    return tx.maintenanceChecklistTemplate.findUnique({
        where: { id },
        include: includeItems ? {
            items: {
                orderBy: { orderIndex: 'asc' }
            }
        } : undefined
    });
};

export const getAllChecklistTemplates = async (includeInactive = false, includeItems = false, tx = prisma) => {
    const where = {};
    if (!includeInactive) {
        where.isActive = true;
    }

    const include = includeItems ? {
        items: {
            orderBy: { orderIndex: 'asc' }
        }
    } : {
        _count: {
            select: { items: true }
        }
    };

    return tx.maintenanceChecklistTemplate.findMany({
        where,
        include,
        orderBy: { name: 'asc' }
    });
};

export const deactivateChecklistTemplate = async (id, tx = prisma) => {
    return tx.maintenanceChecklistTemplate.update({
        where: { id },
        data: { isActive: false }
    });
};

export const createChecklistItems = async (templateId, items, tx = prisma) => {
    if (!items?.length) return [];
    await tx.maintenanceChecklistItem.createMany({
        data: items.map((item, index) => ({
            templateId,
            title: item.title,
            description: item.description,
            isRequired: item.isRequired ?? true,
            orderIndex: item.orderIndex ?? index
        }))
    });
    return tx.maintenanceChecklistItem.findMany({
        where: { templateId },
        orderBy: { orderIndex: 'asc' }
    });
};

export const deleteChecklistItems = async (templateId, tx = prisma) => {
    return tx.maintenanceChecklistItem.deleteMany({
        where: { templateId }
    });
};

export const updateChecklistItems = async (templateId, items, tx = prisma) => {
    await deleteChecklistItems(templateId, tx);
    return createChecklistItems(templateId, items, tx);
};
// Department Assignment Rule Operations

export const createAssignmentRule = async (data, tx = prisma) => {
    return await tx.$transaction(async (txClient) => {
        // Use the provided transaction client or the one from $transaction
        const client = tx === prisma ? txClient : tx;

        // Create rule
        const rule = await client.departmentAssignmentRule.create({
            data: {
                department: data.department,
                assignmentStrategy: data.assignmentStrategy,
                isActive: data.isActive ?? true
            }
        });

        // Create technicians with orderIndex
        const technicians = await Promise.all(
            data.technicianIds.map((userId, index) =>
                client.departmentAssignmentTechnician.create({
                    data: {
                        ruleId: rule.id,
                        userId,
                        orderIndex: index
                    },
                    include: { user: true }
                })
            )
        );

        // Initialize rotation state if ROTATION strategy
        let rotationState = null;
        if (data.assignmentStrategy === 'ROTATION') {
            rotationState = await client.departmentRotationState.create({
                data: {
                    ruleId: rule.id,
                    currentTechnicianIndex: 0
                }
            });
        }

        return {
            ...rule,
            technicians,
            rotationState
        };
    });
};

export const updateAssignmentRule = async (id, data, tx = prisma) => {
    return await tx.$transaction(async (txClient) => {
        const client = tx === prisma ? txClient : tx;

        const updateData = {};
        if (data.department !== undefined) updateData.department = data.department;
        if (data.assignmentStrategy !== undefined) updateData.assignmentStrategy = data.assignmentStrategy;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;

        // Update rule
        const rule = await client.departmentAssignmentRule.update({
            where: { id },
            data: updateData
        });

        // If technicians are being updated, replace them
        if (data.technicianIds) {
            // Delete existing technicians
            await client.departmentAssignmentTechnician.deleteMany({
                where: { ruleId: id }
            });

            // Create new technicians
            await Promise.all(
                data.technicianIds.map((userId, index) =>
                    client.departmentAssignmentTechnician.create({
                        data: {
                            ruleId: id,
                            userId,
                            orderIndex: index
                        }
                    })
                )
            );
        }

        // Return updated rule with relations
        return client.departmentAssignmentRule.findUnique({
            where: { id },
            include: {
                technicians: {
                    orderBy: { orderIndex: 'asc' },
                    include: { user: true }
                },
                rotationState: true
            }
        });
    });
};

export const getAssignmentRuleById = async (id, includeTechnicians = true, tx = prisma) => {
    return tx.departmentAssignmentRule.findUnique({
        where: { id },
        include: includeTechnicians ? {
            technicians: {
                orderBy: { orderIndex: 'asc' },
                include: { user: true }
            },
            rotationState: true
        } : {}
    });
};

export const getAssignmentRuleByDepartment = async (department, includeTechnicians = true, tx = prisma) => {
    return tx.departmentAssignmentRule.findUnique({
        where: { department },
        include: includeTechnicians ? {
            technicians: {
                orderBy: { orderIndex: 'asc' },
                include: { user: true }
            },
            rotationState: true
        } : {}
    });
};

export const getAllAssignmentRules = async (includeInactive = false, includeTechnicians = false, tx = prisma) => {
    const where = {};
    if (!includeInactive) {
        where.isActive = true;
    }

    return tx.departmentAssignmentRule.findMany({
        where,
        include: includeTechnicians ? {
            technicians: {
                orderBy: { orderIndex: 'asc' },
                include: { user: true }
            },
            rotationState: true
        } : {
            _count: {
                select: { technicians: true }
            }
        },
        orderBy: { department: 'asc' }
    });
};

export const deactivateAssignmentRule = async (id, tx = prisma) => {
    return tx.departmentAssignmentRule.update({
        where: { id },
        data: { isActive: false }
    });
};

// Rotation State Operations

export const getRotationState = async (ruleId, tx = prisma) => {
    return tx.departmentRotationState.findUnique({
        where: { ruleId }
    });
};

export const createRotationState = async (ruleId, tx = prisma) => {
    return tx.departmentRotationState.create({
        data: {
            ruleId,
            currentTechnicianIndex: 0
        }
    });
};

export const updateRotationState = async (ruleId, nextIndex, tx = prisma) => {
    return tx.departmentRotationState.update({
        where: { ruleId },
        data: {
            currentTechnicianIndex: nextIndex,
            lastAssignedAt: new Date()
        }
    });
};

export const resetRotationState = async (ruleId, tx = prisma) => {
    return tx.departmentRotationState.update({
        where: { ruleId },
        data: {
            currentTechnicianIndex: 0,
            lastAssignedAt: null
        }
    });
};

// Maintenance Window Assignment Operations

export const assignMaintenanceWindow = async (windowId, userId, reason, tx = prisma) => {
    return tx.maintenanceWindow.update({
        where: { id: windowId },
        data: {
            assignedToId: userId,
            assignmentTimestamp: new Date(),
            assignmentReason: reason
        },
        include: {
            assignedTo: {
                select: { id: true, username: true }
            }
        }
    });
};

export const getMaintenanceWindowsByAssignee = async (userId, filters = {}, tx = prisma) => {
    const { status, page = 1, limit = 50 } = filters;
    const where = { assignedToId: userId };

    if (status) {
        if (Array.isArray(status)) {
            where.status = { in: status };
        } else {
            where.status = status;
        }
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
        tx.maintenanceWindow.findMany({
            where,
            include: {
                cycleConfig: true,
                assignedTo: {
                    select: { id: true, username: true }
                },
                checklist: true,
                completion: true,
                deviceTypes: true
            },
            orderBy: { scheduledStartDate: 'asc' },
            skip,
            take: limit
        }),
        tx.maintenanceWindow.count({ where })
    ]);

    return {
        data,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

// Maintenance Completion Operations

export const createCompletion = async (windowId, userId, notes, completedItems, options = {}, tx = prisma) => {
    const {
        signerName = null,
        signerSignatureUrl = null,
        signerConfirmedAt = null,
        signoffMode = 'STANDARD'
    } = options || {};

    return await tx.$transaction(async (txClient) => {
        const client = tx === prisma ? txClient : tx;

        // 1. Create completion record
        const completion = await client.maintenanceCompletion.create({
            data: {
                windowId,
                completedById: userId,
                notes: notes || null,
                completedAt: new Date(),
                deviceTypes: await getDeviceTypesForWindow(windowId, client), // Snapshot device types
                signerName,
                signerSignatureUrl,
                signerConfirmedAt,
                signoffMode
            }
        });

        // 2. Create checklist item completions
        if (completedItems && completedItems.length > 0) {
            await client.checklistItemCompletion.createMany({
                data: completedItems.map(item => ({
                    completionId: completion.id,
                    checklistItemId: item.checklistItemId,
                    itemTitle: item.itemTitle,
                    itemDescription: item.itemDescription || null,
                    isRequired: item.isRequired,
                    isCompleted: item.isCompleted
                }))
            });
        }

        // 3. Update window status
        await client.maintenanceWindow.update({
            where: { id: windowId },
            data: {
                status: 'COMPLETED',
                updatedAt: new Date()
            }
        });

        // 4. Return completion with relations
        return await client.maintenanceCompletion.findUnique({
            where: { id: completion.id },
            include: {
                completedBy: {
                    select: { id: true, username: true, role: true }
                },
                window: {
                    include: {
                        cycleConfig: true
                    }
                },
                checklistItems: true
            }
        });
    });
};

export const getCompletionByWindowId = async (windowId, includeItems = true, tx = prisma) => {
    return tx.maintenanceCompletion.findUnique({
        where: { windowId },
        include: {
            completedBy: {
                select: { id: true, username: true, role: true }
            },
            checklistItems: includeItems
        }
    });
};

export const getCompletionBySignerSignatureUrl = async (signerSignatureUrl, tx = prisma) => {
    return tx.maintenanceCompletion.findFirst({
        where: { signerSignatureUrl },
        select: {
            id: true,
            signerSignatureUrl: true
        }
    });
};

export const getCompletionsByUserId = async (userId, filters = {}, tx = prisma) => {
    const { page = 1, limit = 50, startDate, endDate, deviceType } = filters;
    const where = { completedById: userId };

    if (startDate) {
        where.completedAt = { ...where.completedAt, gte: new Date(startDate) };
    }
    if (endDate) {
        where.completedAt = { ...where.completedAt, lte: new Date(endDate) };
    }

    const skip = (page - 1) * limit;

    const include = {
        completedBy: {
            select: { id: true, username: true, role: true }
        },
        checklistItems: {
            orderBy: { createdAt: 'asc' }
        },
        window: {
            include: {
                cycleConfig: true,
                deviceTypes: true
            }
        },
        _count: {
            select: { checklistItems: true }
        }
    };

    const orderBy = { completedAt: 'desc' };

    // Device-type history filtering must honor completion snapshots first.
    if (deviceType) {
        const allRecords = await tx.maintenanceCompletion.findMany({
            where,
            include,
            orderBy
        });

        const filtered = allRecords.filter((record) => {
            const snapshotTypes = Array.isArray(record.deviceTypes)
                ? record.deviceTypes.filter((value) => typeof value === 'string')
                : [];

            if (snapshotTypes.length > 0) {
                return snapshotTypes.includes(deviceType);
            }

            const windowTypes = Array.isArray(record.window?.deviceTypes)
                ? record.window.deviceTypes
                    .map((relation) => relation?.deviceType)
                    .filter(Boolean)
                : [];

            return windowTypes.includes(deviceType);
        });

        const total = filtered.length;
        const data = filtered.slice(skip, skip + limit);

        return {
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    const [data, total] = await Promise.all([
        tx.maintenanceCompletion.findMany({
            where,
            include,
            orderBy,
            skip,
            take: limit
        }),
        tx.maintenanceCompletion.count({ where })
    ]);

    return {
        data,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

export const updateCompletionNotes = async (completionId, notes, tx = prisma) => {
    return tx.maintenanceCompletion.update({
        where: { id: completionId },
        data: { notes }
    });
};

export const markUpcomingNotificationSent = async (windowId, tx = prisma) => {
    return tx.maintenanceWindow.update({
        where: { id: windowId },
        data: { upcomingNotificationSentAt: new Date() }
    });
};

export const markOverdueNotificationSent = async (windowId, tx = prisma) => {
    return tx.maintenanceWindow.update({
        where: { id: windowId },
        data: { overdueNotificationSentAt: new Date() }
    });
};

export const getWindowsNeedingUpcomingNotification = async (daysAdvance = 30, tx = prisma) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAdvance);

    return tx.maintenanceWindow.findMany({
        where: {
            status: 'UPCOMING',
            scheduledStartDate: {
                gt: new Date(),
                lte: targetDate
            },
            upcomingNotificationSentAt: null
        },
        include: {
            cycleConfig: true,
            assignedTo: { select: { id: true, username: true } },
            deviceTypes: true
        }
    });
};

export const getWindowsNeedingOverdueNotification = async (tx = prisma) => {
    return tx.maintenanceWindow.findMany({
        where: {
            status: 'OVERDUE',
            scheduledStartDate: { lt: new Date() },
            overdueNotificationSentAt: null
        },
        include: {
            cycleConfig: true,
            assignedTo: { select: { id: true, username: true } },
            deviceTypes: true
        }
    });
};
