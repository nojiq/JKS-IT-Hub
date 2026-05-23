import { z } from "zod";

const optionalText = (max) => z.string().trim().max(max).optional().nullable();

export const listIpInventoryQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  source: z.enum(["asset", "manual"]).optional(),
  subnetId: z.string().uuid().optional()
});

export const manualIpCreateSchema = z.object({
  ipAddress: z.string().trim().min(1).max(45),
  hostname: optionalText(255),
  location: optionalText(191),
  department: optionalText(191),
  macAddress: optionalText(50),
  notes: optionalText(2000)
});

export const manualIpUpdateSchema = manualIpCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required" }
);

export const subnetCreateSchema = z.object({
  cidr: z.string().trim().min(1).max(50),
  purpose: z.string().trim().min(1).max(191),
  description: optionalText(2000)
});

export const subnetUpdateSchema = subnetCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required" }
);
