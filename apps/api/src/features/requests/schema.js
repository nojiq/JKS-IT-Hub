import { z } from 'zod';

export const submitRequestSchema = z.object({
    itemName: z.string().min(1, "Item name is required").max(200, "Item name too long"),
    description: z.string().max(1000, "Description too long").optional(),
    justification: z.string().min(1, "Justification is required").max(1000, "Justification too long"),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    category: z.string().max(100, "Category too long").optional()
});

export const listRequestsQuerySchema = z.object({
    status: z.enum(['SUBMITTED', 'IT_REVIEWED', 'APPROVED', 'REJECTED', 'ALREADY_PURCHASED']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    search: z.string().max(200, "Search query too long").optional(),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20)
});

export const requestIdParamSchema = z.object({
    id: z.string().uuid("Invalid request ID")
});

export const uploadInvoiceParamsSchema = requestIdParamSchema;

export const itReviewSchema = z.object({
    itReview: z.string().trim().max(1000, "Review notes too long").optional()
});

export const alreadyPurchasedSchema = z.object({
    reason: z.string().trim().min(1, "Reason is required").max(1000, "Reason too long")
});

export const rejectRequestSchema = z.object({
    rejectionReason: z.string().trim().min(1, "Rejection reason is required").max(1000, "Reason too long")
});
