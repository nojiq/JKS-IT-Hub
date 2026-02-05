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

// Regeneration Schemas (Story 2.4)
export const regenerateRequestSchema = z.object({
    // Regeneration request doesn't require body parameters
    // UserId comes from URL params
    reason: z.string().optional() // Optional reason for regeneration
});

export const confirmRegenerationSchema = z.object({
    previewToken: z.string().min(1, "Preview token is required"),
    confirmed: z.boolean().refine((val) => val === true, {
        message: "Explicit confirmation required to overwrite credentials"
    }),
    acknowledgedWarnings: z.boolean().default(false),
    skipLocked: z.boolean().optional(),
    force: z.boolean().optional(),
    csrfToken: z.string().optional()
});

// Credential History Schemas (Story 2.5)

export const historyQuerySchema = z.object({
    system: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
}).refine(
    (data) => {
        // If both dates provided, ensure startDate <= endDate
        if (data.startDate && data.endDate) {
            return new Date(data.startDate) <= new Date(data.endDate);
        }
        return true;
    },
    {
        message: "startDate must be before or equal to endDate",
        path: ["startDate"]
    }
);

export const versionIdSchema = z.object({
    versionId: z.string().uuid("Invalid version ID format")
});

export const compareVersionsSchema = z.object({
    versionId1: z.string().uuid("Invalid version ID 1 format"),
    versionId2: z.string().uuid("Invalid version ID 2 format")
});

// Credential Override Schemas (Story 2.6)

export const overridePreviewSchema = z.object({
    username: z.string().min(1).max(191).optional(),
    password: z.string().min(1).optional(),
    reason: z.string().min(10, "Reason must be at least 10 characters").max(500)
}).refine(
    (data) => data.username || data.password,
    { message: "At least one of username or password must be provided" }
);

export const confirmOverrideSchema = z.object({
    previewToken: z.string().min(1, "Preview token is required"),
    confirmed: z.boolean().refine((val) => val === true, {
        message: "Explicit confirmation required"
    })
});

// Lock/Unlock Schemas (Story 2.9)
export const lockCredentialSchema = z.object({
    reason: z.string().max(255).optional()
});

export const unlockCredentialSchema = z.object({
});
});
