import { z } from "zod";

const itemKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Item key must be kebab-case");

const idSchema = z.string().trim().min(1, "ID is required");

export const createCatalogItemSchema = z.object({
  itemKey: itemKeySchema,
  label: z.string().trim().min(1, "Label is required").max(191),
  loginUrl: z.string().trim().url("Login URL must be a valid URL"),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  isItOnly: z.boolean().default(false)
});

export const updateCatalogItemSchema = createCatalogItemSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export const createDepartmentBundleSchema = z.object({
  department: z.string().trim().min(1, "Department is required").max(191),
  catalogItemKeys: z.array(itemKeySchema).min(1, "Select at least one catalog item"),
  isActive: z.boolean().default(true)
});

export const updateDepartmentBundleSchema = createDepartmentBundleSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export const previewOnboardingSchema = z.object({
  mode: z.enum(["existing_user", "manual"]),
  userId: idSchema.optional(),
  draftId: idSchema.optional(),
  manualIdentity: z
    .object({
      fullName: z.string().trim().min(1, "Full name is required").max(191),
      email: z.string().trim().email("Email must be valid"),
      department: z.string().trim().min(1, "Department is required").max(191)
    })
    .optional(),
  selectedCatalogItemKeys: z.array(itemKeySchema).min(1, "Select at least one catalog item")
}).superRefine((value, ctx) => {
  if (value.mode === "existing_user" && !value.userId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["userId"],
      message: "User is required for existing-user onboarding"
    });
  }

  if (value.mode === "manual" && !value.manualIdentity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["manualIdentity"],
      message: "Manual identity is required for manual onboarding"
    });
  }
});

export const confirmOnboardingSchema = z.object({
  previewToken: z.string().trim().min(1, "Preview token is required"),
  confirmed: z.boolean().refine((value) => value === true, {
    message: "Explicit confirmation required"
  })
});

export const linkOnboardingDraftSchema = z.object({
  userId: idSchema
});

export const listDirectoryUsersSchema = z.object({
  search: z.string().trim().max(191).optional()
});

export const listOnboardingDraftsSchema = z.object({
  status: z.enum(["all", "linked", "unlinked"]).default("all")
});
