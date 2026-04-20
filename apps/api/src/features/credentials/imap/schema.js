import { z } from "zod";

const imapInputFieldsSchema = z.object({
    email: z.string().max(191).optional(),
    firstName: z.string().max(191).optional(),
    lastName: z.string().max(191).optional(),
    fullName: z.string().max(191).optional(),
    dob: z.string().max(191).optional(),
    phone: z.string().max(191).optional()
});

const imapSelectedFieldsSchema = z.object({
    email: z.boolean().optional(),
    firstName: z.boolean().optional(),
    lastName: z.boolean().optional(),
    fullName: z.boolean().optional(),
    dob: z.boolean().optional(),
    phone: z.boolean().optional()
});

export const previewImapGeneratorSchema = z.object({
    userId: z.string().min(1).optional(),
    username: z.string().min(1).optional(),
    manualIdentity: z.object({
        fullName: z.string().trim().min(1),
        email: z.string().trim().email()
    }).optional(),
    inputs: imapInputFieldsSchema.default({}),
    selectedFields: imapSelectedFieldsSchema.default({})
});

export const saveImapGeneratorSchema = previewImapGeneratorSchema.extend({
    setActive: z.boolean().optional().default(false)
});

export const reviewImapConflictsSchema = z.object({
    fields: z.record(z.enum(["keep_system", "use_ldap"])).default({})
});
