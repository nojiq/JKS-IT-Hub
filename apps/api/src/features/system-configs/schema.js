import { z } from "zod";

export const createSystemConfigSchema = z.object({
    systemId: z.string()
        .min(1, "System ID is required")
        .max(50, "System ID must be 50 characters or less")
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Must be kebab-case (e.g., "corporate-vpn")'),
    usernameLdapField: z.string()
        .min(1, "Username LDAP field is required")
        .max(100, "Field name must be 100 characters or less"),
    description: z.string()
        .max(500, "Description must be 500 characters or less")
        .optional(),
    isItOnly: z.boolean().optional()
});

export const updateSystemConfigSchema = z.object({
    usernameLdapField: z.string()
        .min(1, "Username LDAP field is required")
        .max(100, "Field name must be 100 characters or less")
        .optional(),
    description: z.string()
        .max(500, "Description must be 500 characters or less")
        .optional(),
    isItOnly: z.boolean().optional()
}).refine(
    data => data.usernameLdapField !== undefined || data.description !== undefined || data.isItOnly !== undefined,
    { message: "At least one field must be provided for update" }
);

export const systemIdParamSchema = z.object({
    systemId: z.string().min(1, "System ID is required")
});
