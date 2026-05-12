import { z } from "zod";

const charsetSchema = z
    .object({
        uppercase: z.boolean(),
        lowercase: z.boolean(),
        digit: z.boolean(),
        special: z.boolean()
    })
    .refine((c) => c.uppercase || c.lowercase || c.digit || c.special, {
        message: "At least one character class must be enabled"
    });

export const previewActualPasswordSchema = z
    .object({
        fullName: z.string().max(500).default(""),
        email: z.string().max(191).default(""),
        dob: z.string().max(100).default(""),
        temporaryPassword: z.string().max(500).default(""),
        length: z.number().int().min(8).max(24),
        charset: charsetSchema
    })
    .superRefine((data, ctx) => {
        const enabledCount = [
            data.charset.uppercase,
            data.charset.lowercase,
            data.charset.digit,
            data.charset.special
        ].filter(Boolean).length;
        if (data.length < enabledCount) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Length must be at least the number of enabled character classes",
                path: ["length"]
            });
        }

        const emailTrimmed = data.email.trim();
        if (emailTrimmed && !z.string().email().safeParse(emailTrimmed).success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Invalid email format",
                path: ["email"]
            });
        }
    });
