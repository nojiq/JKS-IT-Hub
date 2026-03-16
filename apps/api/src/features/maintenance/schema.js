
import { z } from 'zod';

export const createCycleSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    intervalMonths: z.number().int().min(1).max(24),
    defaultChecklistTemplateId: z.string().uuid().optional()
});

export const updateCycleSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    intervalMonths: z.number().int().min(1).max(24).optional(),
    isActive: z.boolean().optional(),
    defaultChecklistTemplateId: z.string().uuid().optional()
});

export const deviceTypeSchema = z.enum(['LAPTOP', 'DESKTOP_PC', 'SERVER']);

export const deviceTypesArraySchema = z.array(deviceTypeSchema)
    .min(1, 'At least one device type is required')
    .max(3, 'Maximum 3 device types allowed')
    .superRefine((types, ctx) => {
        const unique = new Set(types);
        if (unique.size !== types.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Device types must be unique'
            });
        }
    });

export const createWindowSchema = z.object({
    cycleConfigId: z.string().uuid(),
    scheduledStartDate: z.string().datetime(), // ISO 8601
    scheduledEndDate: z.string().datetime().optional(),
    checklistTemplateId: z.string().uuid().optional(),
    departmentId: z.string().optional(),
    deviceTypes: deviceTypesArraySchema
});

export const updateWindowSchema = z.object({
    scheduledStartDate: z.string().datetime().optional(),
    scheduledEndDate: z.union([z.string().datetime(), z.null()]).optional(),
    checklistTemplateId: z.string().uuid().optional(),
    departmentId: z.string().optional(),
    deviceTypes: deviceTypesArraySchema.optional()
});

export const cancelWindowSchema = z.object({
    reason: z.string().max(500)
});

export const listWindowsQuerySchema = z.object({
    cycleId: z.string().uuid().optional(),
    status: z.union([
        z.enum(['SCHEDULED', 'UPCOMING', 'OVERDUE', 'COMPLETED', 'CANCELLED']),
        z.array(z.enum(['SCHEDULED', 'UPCOMING', 'OVERDUE', 'COMPLETED', 'CANCELLED']))
    ]).optional(),
    startDateFrom: z.string().datetime().optional(),
    startDateTo: z.string().datetime().optional(),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(50),
    deviceType: deviceTypeSchema.optional(),
    search: z.string().max(200).optional(),
    assignedTo: z.string().uuid().optional()
});

export const generateScheduleSchema = z.object({
    monthsAhead: z.coerce.number().int().min(12).max(24).default(12),
    department: z.string().optional()
});

export const checklistItemSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    isRequired: z.boolean().default(true),
    orderIndex: z.number().int().min(0)
});

const checklistItemsArraySchema = z.array(checklistItemSchema)
    .min(1, 'At least one checklist item is required')
    .superRefine((items, ctx) => {
        const sortedIndexes = items.map((item) => item.orderIndex).sort((a, b) => a - b);
        const hasSequentialOrder = sortedIndexes.every((orderIndex, index) => orderIndex === index);
        if (!hasSequentialOrder) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Checklist item orderIndex values must be sequential starting at 0'
            });
        }
    });

export const createChecklistTemplateSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    items: checklistItemsArraySchema
});

export const updateChecklistTemplateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
    items: checklistItemsArraySchema.optional()
});
// Department Assignment Rule Schemas

export const assignmentStrategyEnum = z.enum(['FIXED', 'ROTATION']);

export const createAssignmentRuleSchema = z.object({
    department: z.string().min(1).max(100),
    assignmentStrategy: assignmentStrategyEnum,
    technicianIds: z.array(z.string().uuid()).min(1, 'At least one technician is required')
});

export const updateAssignmentRuleSchema = z.object({
    department: z.string().min(1).max(100).optional(),
    assignmentStrategy: assignmentStrategyEnum.optional(),
    isActive: z.boolean().optional(),
    technicianIds: z.array(z.string().uuid()).min(1).optional()
});

export const manualAssignSchema = z.object({
    userId: z.string().uuid()
});

export const resetRotationSchema = z.object({
    // Empty schema, no body parameters required
});

export const completedItemSchema = z.object({
    checklistItemId: z.string().uuid(),
    itemTitle: z.string().min(1).max(200),
    itemDescription: z.string().max(1000).optional(),
    isRequired: z.boolean(),
    isCompleted: z.boolean()
});

const MAX_SIGNATURE_SIZE_BYTES = 300 * 1024;
const SIGNATURE_DATA_URL_PREFIX = 'data:image/png;base64,';

const assistedSignerSchema = z.object({
    name: z.string().trim().min(1).max(200),
    signatureDataUrl: z.string().min(1).superRefine((value, ctx) => {
        if (!value.startsWith(SIGNATURE_DATA_URL_PREFIX)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'signatureDataUrl must be a PNG data URL'
            });
            return;
        }

        const base64Payload = value.slice(SIGNATURE_DATA_URL_PREFIX.length);
        if (!/^[A-Za-z0-9+/=]+$/.test(base64Payload)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'signatureDataUrl contains invalid base64 content'
            });
            return;
        }

        const decoded = Buffer.from(base64Payload, 'base64');
        if (decoded.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'signatureDataUrl cannot be empty'
            });
            return;
        }

        if (decoded.length > MAX_SIGNATURE_SIZE_BYTES) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `signatureDataUrl exceeds max size of ${MAX_SIGNATURE_SIZE_BYTES} bytes`
            });
        }
    })
});

export const signOffSchema = z.object({
    completedItems: z.array(completedItemSchema).min(1, 'At least one checklist item is required'),
    notes: z.string().max(2000).optional(),
    assistedSigner: assistedSignerSchema.optional()
});

export const getCompletionHistorySearchSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(10),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    deviceType: deviceTypeSchema.optional()
});

export const getMyTasksQuerySchema = z.object({
    status: z.union([
        z.enum(['SCHEDULED', 'UPCOMING', 'OVERDUE', 'COMPLETED', 'CANCELLED']),
        z.array(z.enum(['SCHEDULED', 'UPCOMING', 'OVERDUE', 'COMPLETED', 'CANCELLED']))
    ]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
});
