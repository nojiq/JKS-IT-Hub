import { z } from "zod";

export const templateStructureSchema = z.object({
    systems: z.array(z.string()).min(1, "At least one system is required"),
    fields: z.array(z.object({
        name: z.string().min(1, "Field name is required"),
        ldapSource: z.string().optional(),
        type: z.string().optional(), // Allow 'generated' or others
        pattern: z.string().optional(),
        required: z.boolean().optional(),
        normalization: z.array(z.enum(['lowercase', 'uppercase', 'trim', 'removeSpaces'])).optional()
    })).min(1, "At least one field is required")
        .refine(
            (fields) => fields.every(f => f.ldapSource || f.type === 'generated' || f.type === 'static'),
            "Each field must have an ldapSource or be type='generated'/'static'"
        ),
    normalizationRules: z.object({
        lowercase: z.boolean().optional(),
        removeSpaces: z.boolean().optional(),
        trim: z.boolean().optional()
    }).optional()
});

export const createTemplateSchema = z.object({
    name: z.string().min(3).max(100),
    description: z.string().optional(),
    structure: templateStructureSchema,
    isActive: z.boolean().default(true)
});

export const updateTemplateSchema = z.object({
    name: z.string().min(3).max(100).optional(),
    description: z.string().optional(),
    structure: templateStructureSchema.optional(),
    isActive: z.boolean().optional()
});

// Preview and Confirm Schemas
export const previewRequestSchema = z.object({
    // Preview request doesn't require body parameters
    // UserId comes from URL params
});

export const confirmCredentialsSchema = z.object({
    previewToken: z.string().min(1, "Preview token is required"),
    confirmed: z.boolean().refine((val) => val === true, {
        message: "Explicit confirmation required"
    }),
    csrfToken: z.string().optional() // For CSRF protection
});
