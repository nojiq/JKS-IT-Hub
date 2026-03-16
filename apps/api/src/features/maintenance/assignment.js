import * as repo from './repo.js';
import { prisma } from '../../shared/db/prisma.js';

const MAX_ROTATION_RETRIES = 3;

const filterActiveTechnicians = (rule) =>
    rule.technicians.filter((technician) => technician.user && technician.user.status === 'active');

/**
 * Auto-assign a maintenance window based on department assignment rules
 * @param {string} windowId - The maintenance window ID to assign
 * @param {string} department - The department name for assignment rule lookup
 * @returns {Promise<object|null>} The assigned window or null if assignment failed
 */
export async function autoAssignMaintenanceWindow(windowId, department) {
    try {
        for (let attempt = 1; attempt <= MAX_ROTATION_RETRIES; attempt++) {
            const result = await prisma.$transaction(async (tx) => {
                const rule = await repo.getAssignmentRuleByDepartment(department, true, tx);

                if (!rule || !rule.isActive) {
                    return { status: 'no-rule' };
                }

                const technicians = filterActiveTechnicians(rule);
                if (technicians.length === 0) {
                    return { status: 'no-technicians' };
                }

                let assignedUserId;
                let assignmentReason;

                if (rule.assignmentStrategy === 'FIXED') {
                    assignedUserId = technicians[0].userId;
                    assignmentReason = 'fixed-assignment';
                } else if (rule.assignmentStrategy === 'ROTATION') {
                    const rawIndex = rule.rotationState?.currentTechnicianIndex ?? 0;
                    const normalizedIndex = rawIndex >= technicians.length ? 0 : rawIndex;
                    const nextIndex = (normalizedIndex + 1) % technicians.length;

                    assignedUserId = technicians[normalizedIndex].userId;
                    assignmentReason = 'rotation';

                    if (rule.rotationState) {
                        const updateResult = await tx.departmentRotationState.updateMany({
                            where: {
                                ruleId: rule.id,
                                currentTechnicianIndex: rawIndex
                            },
                            data: {
                                currentTechnicianIndex: nextIndex,
                                lastAssignedAt: new Date()
                            }
                        });

                        if (updateResult.count === 0) {
                            return { status: 'retry' };
                        }
                    } else {
                        try {
                            await tx.departmentRotationState.create({
                                data: {
                                    ruleId: rule.id,
                                    currentTechnicianIndex: nextIndex,
                                    lastAssignedAt: new Date()
                                }
                            });
                        } catch (rotationCreateError) {
                            if (rotationCreateError?.code === 'P2002') {
                                return { status: 'retry' };
                            }
                            throw rotationCreateError;
                        }
                    }
                } else {
                    return { status: 'invalid-strategy' };
                }

                const assignedWindow = await repo.assignMaintenanceWindow(
                    windowId,
                    assignedUserId,
                    assignmentReason,
                    tx
                );

                return { status: 'assigned', assignedWindow };
            });

            if (result.status === 'assigned') {
                return result.assignedWindow;
            }

            if (result.status === 'retry' && attempt < MAX_ROTATION_RETRIES) {
                continue;
            }

            if (result.status === 'no-rule') {
                console.warn(`No active assignment rule for department: ${department}`);
                return null;
            }

            if (result.status === 'no-technicians') {
                console.warn(`No active technicians for department: ${department}`);
                return null;
            }

            console.warn('Failed to auto-assign maintenance window', {
                windowId,
                department,
                status: result.status,
                attempt
            });
            return null;
        }

        console.warn('Failed to auto-assign maintenance window after retry attempts', {
            windowId,
            department,
            retries: MAX_ROTATION_RETRIES
        });
        return null;
    } catch (error) {
        console.error('Failed to auto-assign maintenance window', {
            error: error.message,
            windowId,
            department
        });
        return null;
    }
}

/**
 * Get the next technician in rotation for a given rule
 * @param {string} ruleId - The assignment rule ID
 * @returns {Promise<object|null>} The next technician or null if not found
 */
export async function getNextRotationTechnician(ruleId) {
    try {
        // Load rotation state
        const rotationState = await repo.getRotationState(ruleId);
        if (!rotationState) {
            console.warn(`No rotation state found for rule: ${ruleId}`);
            return null;
        }

        // Load rule technicians ordered by orderIndex
        const rule = await repo.getAssignmentRuleById(ruleId, true);
        if (!rule || !rule.technicians || rule.technicians.length === 0) {
            console.warn(`No technicians found for rule: ${ruleId}`);
            return null;
        }

        const activeTechnicians = filterActiveTechnicians(rule);
        if (activeTechnicians.length === 0) {
            console.warn(`No active technicians found for rule: ${ruleId}`);
            return null;
        }

        // Get technician at current rotation index
        const currentIndex = rotationState.currentTechnicianIndex;
        if (currentIndex >= activeTechnicians.length) {
            console.warn(`Invalid rotation index ${currentIndex} for rule with ${activeTechnicians.length} active technicians`);
            return null;
        }

        return activeTechnicians[currentIndex];
    } catch (error) {
        console.error('Failed to get next rotation technician', {
            error: error.message,
            ruleId
        });
        return null;
    }
}

/**
 * Advance rotation state to next technician
 * @param {string} ruleId - The assignment rule ID
 * @returns {Promise<object>} The updated rotation state
 */
export async function advanceRotation(ruleId) {
    const rotationState = await repo.getRotationState(ruleId);
    if (!rotationState) {
        throw new Error('Rotation state not found');
    }

    const rule = await repo.getAssignmentRuleById(ruleId, true);
    if (!rule || !rule.technicians) {
        throw new Error('Assignment rule or technicians not found');
    }

    const technicianCount = rule.technicians.length;
    if (technicianCount === 0) {
        throw new Error('No technicians available for rotation');
    }

    const nextIndex = (rotationState.currentTechnicianIndex + 1) % technicianCount;

    await repo.updateRotationState(ruleId, nextIndex);

    return {
        ruleId,
        currentTechnicianIndex: nextIndex,
        lastAssignedAt: new Date()
    };
}

/**
 * Validate assignment rule data before creating/updating
 * @param {object} ruleData - The assignment rule data to validate
 * @param {object[]} users - Array of user objects to validate against
 * @returns {object} Validation result with { valid: boolean, errors: string[] }
 */
export function validateAssignmentRule(ruleData, users) {
    const errors = [];

    // Check department is not empty
    if (!ruleData.department || ruleData.department.trim() === '') {
        errors.push('Department cannot be empty');
    }

    // Check technician list is not empty
    if (!ruleData.technicianIds || ruleData.technicianIds.length === 0) {
        errors.push('At least one technician is required');
    }

    // Validate all technician user IDs exist and are active
    if (ruleData.technicianIds && users) {
        const userMap = new Map(users.map(u => [u.id, u]));
        const invalidIds = [];
        const inactiveIds = [];

        for (const userId of ruleData.technicianIds) {
            const user = userMap.get(userId);
            if (!user) {
                invalidIds.push(userId);
            } else if (user.status !== 'active') {
                inactiveIds.push(userId);
            }
        }

        if (invalidIds.length > 0) {
            errors.push(`Invalid user IDs: ${invalidIds.join(', ')}`);
        }

        if (inactiveIds.length > 0) {
            errors.push(`Inactive users cannot be assigned: ${inactiveIds.join(', ')}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
