import { z } from "zod";

export const ruleTypeEnum = z.enum([
    'lowercase',
    'uppercase',
    'trim',
    'remove_spaces',
    'remove_special',
    'truncate',
    'regex'
]);

export const createNormalizationRuleSchema = z.object({
    systemId: z.string().optional(),
    ruleType: ruleTypeEnum,
    ruleConfig: z.object({}).passthrough().default({}),
    priority: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true)
}).refine(
    (data) => {
        // Validate config based on ruleType
        switch (data.ruleType) {
            case 'truncate':
                return data.ruleConfig && typeof data.ruleConfig.maxLength === 'number' && data.ruleConfig.maxLength >= 1;
            case 'regex':
                return data.ruleConfig && typeof data.ruleConfig.pattern === 'string' && data.ruleConfig.pattern.length > 0;
            default:
                return true; // lowercase, remove_spaces, remove_special need no config
        }
    },
    {
        message: "Invalid ruleConfig for the specified ruleType",
        path: ['ruleConfig']
    }
);

export const updateNormalizationRuleSchema = z.object({
    ruleConfig: z.object({}).passthrough().optional(),
    priority: z.number().int().min(0).optional(),
    isActive: z.boolean().optional()
}).refine(
    data => data.ruleConfig !== undefined || data.priority !== undefined || data.isActive !== undefined,
    { message: "At least one field must be provided for update" }
);

export const reorderRulesSchema = z.object({
    ruleIds: z.array(z.string().uuid()).min(1)
});

export const previewNormalizationSchema = z.object({
    value: z.string().min(1, "Test value is required"),
    systemId: z.string().optional()
});

export const ruleIdParamSchema = z.object({
    ruleId: z.string().uuid("Invalid rule ID")
});
