import { z } from 'zod';

const checklistItemInputSchema = z.object({
    title: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    required: z.boolean().optional().default(true),
    evidenceRequired: z.boolean().optional().default(false)
});

export const createProfileSchema = z.object({
    name: z.string().min(1).max(191),
    description: z.string().max(2000).optional(),
    intervalMonths: z.number().int().min(1).max(24),
    gracePeriodDays: z.number().int().min(0).max(90).optional().default(0),
    checklistItems: z.array(checklistItemInputSchema).min(1)
});

export const updateProfileSchema = z.object({
    name: z.string().min(1).max(191).optional(),
    description: z.string().max(2000).optional(),
    intervalMonths: z.number().int().min(1).max(24).optional(),
    gracePeriodDays: z.number().int().min(0).max(90).optional(),
    isActive: z.boolean().optional()
});

export const saveProfileChecklistSchema = z.object({
    items: z.array(checklistItemInputSchema).min(1)
});

export const createAssignmentSchema = z.object({
    assetId: z.string().uuid(),
    profileId: z.string().uuid(),
    userId: z.string().uuid(),
    startDate: z.string().datetime().optional()
});

export const listRunsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(50),
    status: z.union([
        z.enum(['scheduled', 'due', 'in_progress', 'overdue', 'completed', 'skipped', 'cancelled']),
        z.array(z.enum(['scheduled', 'due', 'in_progress', 'overdue', 'completed', 'skipped', 'cancelled']))
    ]).optional(),
    assetId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    search: z.string().max(200).optional()
});

export const updateRunItemSchema = z.object({
    status: z.enum(['pending', 'pass', 'fail', 'na']),
    notes: z.string().max(2000).optional(),
    evidenceUrl: z.string().url().max(2000).optional()
});
