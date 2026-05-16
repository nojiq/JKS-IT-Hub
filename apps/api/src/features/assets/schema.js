import { z } from "zod";

const assignmentSourceFilter = z.enum([
  "auto_matched",
  "auto_username",
  "auto_email",
  "manual",
  "unmatched",
  "unassigned",
  "non_user"
]);

export const listAssetsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.string().trim().max(191).optional(),
  category: z.string().trim().max(191).optional(),
  assignmentSource: assignmentSourceFilter.optional(),
  assignedTo: z.string().uuid().optional(),
  linked: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20)
});

export const linkUserSchema = z.object({
  userId: z.string().uuid()
});
