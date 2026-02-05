import { prisma } from "../../shared/db/prisma.js";

export const createNormalizationRule = async (data, tx = prisma) => {
    return tx.normalizationRule.create({ data });
};

export const getNormalizationRules = async (tx = prisma) => {
    return tx.normalizationRule.findMany({
        orderBy: [
            { systemId: 'asc' },
            { priority: 'asc' },
            { createdAt: 'asc' }
        ]
    });
};

export const getActiveRulesBySystemId = async (systemId, tx = prisma) => {
    // Get global rules (systemId is null) or per-system rules
    return tx.normalizationRule.findMany({
        where: {
            systemId,
            isActive: true
        },
        orderBy: { priority: 'asc' }
    });
};

export const getNormalizationRuleById = async (id, tx = prisma) => {
    return tx.normalizationRule.findUnique({
        where: { id }
    });
};

export const updateNormalizationRule = async (id, data, tx = prisma) => {
    return tx.normalizationRule.update({
        where: { id },
        data
    });
};

export const deleteNormalizationRule = async (id, tx = prisma) => {
    return tx.normalizationRule.delete({
        where: { id }
    });
};

export const findDuplicateRule = async (ruleData, tx = prisma) => {
    const whereClause = {
        ruleType: ruleData.ruleType,
        systemId: ruleData.systemId || null,
        isActive: true
    };

    // For rules with config, also check config similarity
    if (ruleData.ruleConfig && Object.keys(ruleData.ruleConfig).length > 0) {
        // For truncate rules, check if same maxLength
        if (ruleData.ruleType === 'truncate') {
            const existingRules = await tx.normalizationRule.findMany({
                where: whereClause
            });
            return existingRules.find(r => 
                r.ruleConfig?.maxLength === ruleData.ruleConfig?.maxLength
            );
        }
        
        // For regex rules, check if same pattern
        if (ruleData.ruleType === 'regex') {
            const existingRules = await tx.normalizationRule.findMany({
                where: whereClause
            });
            return existingRules.find(r => 
                r.ruleConfig?.pattern === ruleData.ruleConfig?.pattern
            );
        }
    }
    
    // For simple rules (lowercase, remove_spaces, remove_special), any existing rule of same type
    return tx.normalizationRule.findFirst({
        where: whereClause
    });
};

export const reorderRules = async (ruleIds, tx = prisma) => {
    const updates = ruleIds.map((id, index) => 
        tx.normalizationRule.update({
            where: { id },
            data: { priority: index }
        })
    );
    return Promise.all(updates);
};
