import * as repo from "./repo.js";
import * as systemConfigRepo from "../system-configs/repo.js";
import { prisma } from "../../shared/db/prisma.js";

/**
 * Error when rule configuration is invalid
 */
export class InvalidRuleConfigError extends Error {
    constructor(message, field = null) {
        super(message);
        this.name = 'InvalidRuleConfigError';
        this.code = 'INVALID_RULE_CONFIG';
        this.field = field;
    }
}

/**
 * Error when normalization produces empty output
 */
export class NormalizationEmptyError extends Error {
    constructor(value, rulesApplied) {
        super(`Applying rules to '${value}' would produce an empty string`);
        this.name = 'NormalizationEmptyError';
        this.code = 'NORMALIZATION_EMPTY';
        this.value = value;
        this.rulesApplied = rulesApplied;
    }
}

/**
 * Error when system not found
 */
export class SystemNotFoundError extends Error {
    constructor(systemId) {
        super(`System '${systemId}' not found`);
        this.name = 'SystemNotFoundError';
        this.code = 'SYSTEM_NOT_FOUND';
        this.systemId = systemId;
    }
}

/**
 * Error when duplicate rule exists
 */
export class DuplicateRuleError extends Error {
    constructor() {
        super('A similar rule already exists for this scope');
        this.name = 'DuplicateRuleError';
        this.code = 'DUPLICATE_RULE';
    }
}

/**
 * Error when rule not found
 */
export class RuleNotFoundError extends Error {
    constructor(ruleId) {
        super(`Rule '${ruleId}' not found`);
        this.name = 'RuleNotFoundError';
        this.code = 'RULE_NOT_FOUND';
        this.ruleId = ruleId;
    }
}

/**
 * Validate rule configuration based on rule type
 */
const validateRuleConfig = (ruleType, ruleConfig) => {
    switch (ruleType) {
        case 'truncate':
            if (!ruleConfig || typeof ruleConfig.maxLength !== 'number' || ruleConfig.maxLength < 1) {
                throw new InvalidRuleConfigError('Truncate rule requires maxLength >= 1', 'ruleConfig.maxLength');
            }
            break;
        case 'regex':
            if (!ruleConfig || !ruleConfig.pattern) {
                throw new InvalidRuleConfigError('Regex rule requires pattern', 'ruleConfig.pattern');
            }
            try {
                new RegExp(ruleConfig.pattern, ruleConfig.flags || 'g');
            } catch (err) {
                throw new InvalidRuleConfigError(`Invalid regex pattern: ${ruleConfig.pattern}`, 'ruleConfig.pattern');
            }
            break;
        // lowercase, remove_spaces, remove_special require no config
    }
};

/**
 * Apply a single normalization rule
 */
const applyRule = (value, rule) => {
    switch (rule.ruleType) {
        case 'uppercase':
            return value.toUpperCase();
        case 'trim':
            return value.trim();
        case 'lowercase':
            return value.toLowerCase();
        case 'remove_spaces':
            return value.replace(/\s/g, '');
        case 'remove_special':
            return value.replace(/[^a-zA-Z0-9]/g, '');
        case 'truncate':
            const maxLength = rule.ruleConfig?.maxLength;
            if (maxLength && value.length > maxLength) {
                return value.substring(0, maxLength);
            }
            return value;
        case 'regex':
            const { pattern, replacement = '', flags = 'g' } = rule.ruleConfig;
            try {
                const regex = new RegExp(pattern, flags);
                return value.replace(regex, replacement);
            } catch (err) {
                throw new InvalidRuleConfigError(`Invalid regex pattern: ${pattern}`);
            }
        default:
            console.warn(`[Normalization] Unknown rule type: ${rule.ruleType}`);
            return value;
    }
};

/**
 * Apply normalization rules to a value
 */
export const applyNormalizationRules = async (value, systemId = null) => {
    if (!value || typeof value !== 'string') {
        throw new InvalidRuleConfigError('Value must be a non-empty string', 'value');
    }

    // Fetch global rules first
    const globalRules = await repo.getActiveRulesBySystemId(null);

    // Fetch per-system rules if systemId provided
    const systemRules = systemId ? await repo.getActiveRulesBySystemId(systemId) : [];

    // Combine: global first, then system rules (sorted by priority)
    const rules = [...globalRules, ...systemRules]
        .sort((a, b) => a.priority - b.priority);

    let normalized = value;
    const appliedRules = [];

    for (const rule of rules) {
        const before = normalized;
        normalized = applyRule(normalized, rule);

        if (normalized !== before) {
            appliedRules.push({
                ruleId: rule.id,
                ruleType: rule.ruleType,
                scope: rule.systemId === null ? 'global' : 'system',
                before,
                after: normalized,
                config: rule.ruleConfig
            });
        }
    }

    // Validation: ensure not empty
    if (!normalized || normalized.length === 0) {
        throw new NormalizationEmptyError(value, appliedRules);
    }

    // Additional validation: check minimum length
    const warnings = [];
    if (normalized.length < 3) {
        warnings.push('Output is very short (less than 3 characters)');
    }

    return {
        original: value,
        normalized,
        rulesApplied: appliedRules,
        validation: {
            isValid: true,
            length: normalized.length,
            warnings
        }
    };
};

/**
 * Create a new normalization rule
 */
export const createNormalizationRule = async (ruleData, performedBy) => {
    return prisma.$transaction(async (tx) => {
        // 1. Validate rule type
        const validTypes = ['lowercase', 'uppercase', 'trim', 'remove_spaces', 'remove_special', 'truncate', 'regex'];
        if (!validTypes.includes(ruleData.ruleType)) {
            throw new InvalidRuleConfigError(`Invalid rule type. Must be one of: ${validTypes.join(', ')}`, 'ruleType');
        }

        // 2. Validate rule config based on type
        validateRuleConfig(ruleData.ruleType, ruleData.ruleConfig);

        // 3. Validate system exists if specified
        if (ruleData.systemId) {
            const system = await systemConfigRepo.getSystemConfigById(ruleData.systemId, tx);
            if (!system) {
                throw new SystemNotFoundError(ruleData.systemId);
            }
        }

        // 4. Check for duplicate (same type + config for same scope)
        const existing = await repo.findDuplicateRule(ruleData, tx);
        if (existing) {
            throw new DuplicateRuleError();
        }

        // 5. Create rule
        const rule = await repo.createNormalizationRule({
            systemId: ruleData.systemId || null,
            ruleType: ruleData.ruleType,
            ruleConfig: ruleData.ruleConfig || {},
            priority: ruleData.priority ?? 0,
            isActive: ruleData.isActive !== false
        }, tx);

        // 6. Create audit log
        await tx.auditLog.create({
            data: {
                action: 'normalization_rule.create',
                actorUserId: performedBy,
                entityType: 'NormalizationRule',
                entityId: rule.id,
                metadata: {
                    systemId: rule.systemId,
                    ruleType: rule.ruleType,
                    priority: rule.priority,
                    ruleConfig: rule.ruleConfig
                }
            }
        });

        return rule;
    });
};

/**
 * Get all normalization rules
 */
export const getNormalizationRules = async (systemId = null) => {
    if (systemId) {
        // Get both global and per-system rules for this system
        const [globalRules, systemRules] = await Promise.all([
            repo.getActiveRulesBySystemId(null),
            repo.getActiveRulesBySystemId(systemId)
        ]);

        return {
            global: globalRules,
            perSystem: {
                [systemId]: systemRules
            }
        };
    }

    // Get all rules organized by scope
    const allRules = await repo.getNormalizationRules();
    const global = allRules.filter(r => r.systemId === null);
    const perSystem = allRules.filter(r => r.systemId !== null);

    // Group per-system rules
    const perSystemGrouped = perSystem.reduce((acc, rule) => {
        if (!acc[rule.systemId]) {
            acc[rule.systemId] = [];
        }
        acc[rule.systemId].push(rule);
        return acc;
    }, {});

    return { global, perSystem: perSystemGrouped };
};

/**
 * Get rules for a specific system (including global rules)
 */
export const getRulesForSystem = async (systemId) => {
    const [globalRules, systemRules] = await Promise.all([
        repo.getActiveRulesBySystemId(null),
        repo.getActiveRulesBySystemId(systemId)
    ]);

    return {
        global: globalRules,
        systemSpecific: systemRules
    };
};

/**
 * Update an existing normalization rule
 */
export const updateNormalizationRule = async (ruleId, updates, performedBy) => {
    return prisma.$transaction(async (tx) => {
        // 1. Check if rule exists
        const existing = await repo.getNormalizationRuleById(ruleId, tx);
        if (!existing) {
            throw new RuleNotFoundError(ruleId);
        }

        // 2. Validate rule config if being updated
        if (updates.ruleConfig) {
            const ruleType = existing.ruleType;
            validateRuleConfig(ruleType, updates.ruleConfig);
        }

        // 3. Track changes for audit log
        const changes = {};
        if (updates.ruleConfig !== undefined) {
            changes.ruleConfig = {
                old: existing.ruleConfig,
                new: updates.ruleConfig
            };
        }
        if (updates.priority !== undefined && updates.priority !== existing.priority) {
            changes.priority = {
                old: existing.priority,
                new: updates.priority
            };
        }
        if (updates.isActive !== undefined && updates.isActive !== existing.isActive) {
            changes.isActive = {
                old: existing.isActive,
                new: updates.isActive
            };
        }

        // 4. Update rule
        const rule = await repo.updateNormalizationRule(ruleId, {
            ...(updates.ruleConfig !== undefined && { ruleConfig: updates.ruleConfig }),
            ...(updates.priority !== undefined && { priority: updates.priority }),
            ...(updates.isActive !== undefined && { isActive: updates.isActive })
        }, tx);

        // 5. Create audit log if there were changes
        if (Object.keys(changes).length > 0) {
            await tx.auditLog.create({
                data: {
                    action: 'normalization_rule.update',
                    actorUserId: performedBy,
                    entityType: 'NormalizationRule',
                    entityId: ruleId,
                    metadata: {
                        systemId: existing.systemId,
                        ruleType: existing.ruleType,
                        changes
                    }
                }
            });
        }

        return rule;
    });
};

/**
 * Delete a normalization rule
 */
export const deleteNormalizationRule = async (ruleId, performedBy) => {
    return prisma.$transaction(async (tx) => {
        // 1. Check if rule exists
        const existing = await repo.getNormalizationRuleById(ruleId, tx);
        if (!existing) {
            throw new RuleNotFoundError(ruleId);
        }

        // 2. Delete rule
        await repo.deleteNormalizationRule(ruleId, tx);

        // 3. Create audit log
        await tx.auditLog.create({
            data: {
                action: 'normalization_rule.delete',
                actorUserId: performedBy,
                entityType: 'NormalizationRule',
                entityId: ruleId,
                metadata: {
                    systemId: existing.systemId,
                    ruleType: existing.ruleType,
                    priority: existing.priority,
                    ruleConfig: existing.ruleConfig,
                    deletedRule: existing
                }
            }
        });

        return { success: true, ruleId };
    });
};

/**
 * Reorder normalization rules
 */
export const reorderNormalizationRules = async (orderedRuleIds, performedBy) => {
    return prisma.$transaction(async (tx) => {
        // 1. Verify all rules exist
        const rules = await Promise.all(
            orderedRuleIds.map(id => repo.getNormalizationRuleById(id, tx))
        );

        const missingIndex = rules.findIndex(r => !r);
        if (missingIndex !== -1) {
            throw new RuleNotFoundError(orderedRuleIds[missingIndex]);
        }

        // 2. Update priorities
        await repo.reorderRules(orderedRuleIds, tx);

        // 3. Create audit log
        await tx.auditLog.create({
            data: {
                action: 'normalization_rule.reorder',
                actorUserId: performedBy,
                entityType: 'NormalizationRule',
                entityId: null,
                metadata: {
                    ruleCount: orderedRuleIds.length,
                    newOrder: orderedRuleIds.map((id, index) => ({ ruleId: id, priority: index }))
                }
            }
        });

        return { success: true, reorderedCount: orderedRuleIds.length };
    });
};

/**
 * Preview normalization on a sample value
 */
export const previewNormalization = async (value, systemId = null) => {
    return applyNormalizationRules(value, systemId);
};
