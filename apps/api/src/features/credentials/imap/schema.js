import { z } from "zod";

export const saveImapPasswordSchema = z
    .object({
        userId: z.string().min(1),
        password: z.string().optional(),
        username: z.string().max(191).optional(),
        restoreCredentialId: z.string().min(1).optional(),
        setActive: z.boolean().optional().default(true)
    })
    .refine(
        (data) => Boolean(data.restoreCredentialId) || Boolean(String(data.password ?? "").trim()),
        { message: "password is required unless restoreCredentialId is set", path: ["password"] }
    );
