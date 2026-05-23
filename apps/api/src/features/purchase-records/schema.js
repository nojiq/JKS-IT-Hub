import { z } from "zod";

export const snipeTypeSchema = z.enum(["HARDWARE", "ACCESSORY", "CONSUMABLE", "LICENSE", "COMPONENT"]);

const decimalLike = z.union([z.string(), z.number()]).optional().transform((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
});

export const purchaseRecordItemInputSchema = z.object({
  itemName: z.string().trim().min(1, "Item name is required").max(200, "Item name too long"),
  description: z.string().trim().max(1000, "Description too long").optional(),
  category: z.string().trim().max(100, "Category too long").optional(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").default(1),
  unitCost: decimalLike,
  marketplaceSource: z.object({
    marketplace: z.enum(["SHOPEE", "LAZADA"]),
    sourceUrl: z.string().url().max(1000),
    imageUrl: z.string().url().max(1000).optional(),
    snapshot: z.record(z.string(), z.unknown()).optional()
  }).optional(),
  snipeType: snipeTypeSchema.optional(),
  snipeId: z.coerce.number().int().positive().optional()
});

export const createPurchaseRecordSchema = z.object({
  reason: z.string().trim().min(1, "Reason is required").max(1000, "Reason too long"),
  requestedForUserId: z.string().uuid().optional(),
  purchasedById: z.string().uuid().optional(),
  purchaseDate: z.string().datetime().optional(),
  vendorName: z.string().trim().max(191, "Vendor name too long").optional(),
  totalAmount: decimalLike,
  currency: z.string().trim().length(3).default("MYR"),
  notes: z.string().trim().max(2000, "Notes too long").optional(),
  approvalStatus: z.enum(["NOT_REQUIRED", "PENDING", "APPROVED", "SKIPPED", "REJECTED"]).default("NOT_REQUIRED"),
  approvalSkipReason: z.string().trim().max(1000, "Approval skip reason too long").optional(),
  approvalNote: z.string().trim().max(1000, "Approval note too long").optional(),
  items: z.array(purchaseRecordItemInputSchema).min(1, "At least one item is required")
});

export const listPurchaseRecordsQuerySchema = z.object({
  recordStatus: z.enum(["RECORDED", "REJECTED", "ARCHIVED"]).optional(),
  approvalStatus: z.enum(["NOT_REQUIRED", "PENDING", "APPROVED", "SKIPPED", "REJECTED"]).optional(),
  requesterId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20)
});

export const purchaseRecordIdParamSchema = z.object({
  id: z.string().uuid("Invalid purchase record ID")
});

export const purchaseRecordItemParamSchema = z.object({
  recordId: z.string().uuid("Invalid purchase record ID"),
  itemId: z.string().uuid("Invalid purchase record item ID")
});

export const verifySnipeSchema = z.object({
  snipeType: snipeTypeSchema,
  snipeId: z.coerce.number().int().positive("Snipe ID is required")
});

export const marketplacePreviewSchema = z.object({
  url: z.string().trim().url("Valid product URL is required").max(1000)
});
