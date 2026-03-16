import { requireAuthenticated } from "../../shared/auth/requireAuthenticated.js";
import { requireItUser } from "../../shared/auth/requireItUser.js";
import { requireAdminOrHead } from "../../shared/auth/requireAdminOrHead.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";
import { validateInvoiceFile } from "../../shared/uploads/validation.js";
import * as service from './service.js';
import {
    submitRequestSchema,
    listRequestsQuerySchema,
    requestIdParamSchema,
    uploadInvoiceParamsSchema,
    itReviewSchema,
    alreadyPurchasedSchema,
    rejectRequestSchema
} from './schema.js';

export default async function (app, { config, userRepo, auditRepo }) {

    // Helper to standardize error response
    const handleError = (reply, error) => {
        const toValidationErrors = () => {
            if (error?.name === 'ZodError' && Array.isArray(error.issues)) {
                return error.issues.map((issue) => ({
                    field: issue.path?.join('.') || 'body',
                    message: issue.message
                }));
            }

            if (error?.name === 'ValidationError') {
                if (Array.isArray(error.errors) && error.errors.length > 0) {
                    return error.errors;
                }
                return [{ field: 'body', message: error.message }];
            }

            return [];
        };

        if (error.statusCode === 403 || error.name === 'Forbidden') {
            return sendProblem(reply, createProblemDetails({ status: 403, title: "Forbidden", detail: error.message }));
        }
        if (error.statusCode === 404 || error.name === 'NotFound') {
            return sendProblem(reply, createProblemDetails({ status: 404, title: "Not Found", detail: error.message }));
        }
        if (error.statusCode === 409 || error.name === 'Conflict') {
            return sendProblem(reply, createProblemDetails({
                type: '/problems/conflict',
                status: 409,
                title: "Conflict",
                detail: error.message
            }));
        }
        if (error.name === 'ZodError') {
            return sendProblem(reply, createProblemDetails({
                type: '/problems/validation-error',
                status: 400,
                title: "Validation Error",
                detail: "Request validation failed.",
                errors: toValidationErrors()
            }));
        }
        if (error.name === 'ValidationError') {
            return sendProblem(reply, createProblemDetails({
                type: '/problems/validation-error',
                status: 400,
                title: "Validation Error",
                detail: error.message,
                errors: toValidationErrors()
            }));
        }

        console.error('Request API Error:', error);
        return sendProblem(reply, createProblemDetails({ status: 500, title: "Internal Server Error", detail: error.message }));
    };

    const parseMultipartFormWithOptionalInvoice = async (request) => {
        const fields = {};
        let file = null;

        for await (const part of request.parts()) {
            if (part.type === 'file') {
                if (part.fieldname !== 'invoice' || file) {
                    for await (const _chunk of part.file) {
                        // Consume unused file streams to avoid hanging the request.
                    }
                    continue;
                }

                const chunks = [];
                for await (const chunk of part.file) {
                    chunks.push(chunk);
                }

                const buffer = Buffer.concat(chunks);
                file = {
                    filename: part.filename,
                    mimetype: part.mimetype,
                    size: buffer.length,
                    buffer
                };
            } else {
                fields[part.fieldname] = part.value;
            }
        }

        return { fields, file };
    };

    const createValidationError = (message, errors = [{ field: 'body', message }]) => {
        const error = new Error(message);
        error.name = 'ValidationError';
        error.errors = errors;
        return error;
    };

    // Submit Request
    app.post("/", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            throw createValidationError("E-invoice is required for request submission.", [
                {
                    field: 'invoice',
                    message: 'E-invoice is required. Submit using /api/v1/requests/with-invoice.'
                }
            ]);
        } catch (err) {
            handleError(reply, err);
        }
    });

    // Submit Request with required invoice in one multipart call
    app.post("/with-invoice", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const { fields, file } = await parseMultipartFormWithOptionalInvoice(request);
            const normalizedFields = { ...fields };

            if (normalizedFields.priority === '') {
                delete normalizedFields.priority;
            }
            if (normalizedFields.description === '') {
                delete normalizedFields.description;
            }
            if (normalizedFields.category === '') {
                delete normalizedFields.category;
            }

            if (!file) {
                throw createValidationError("E-invoice is required for request submission.", [
                    {
                        field: 'invoice',
                        message: 'E-invoice file is required.'
                    }
                ]);
            }

            const fileValidationErrors = validateInvoiceFile(file);
            if (fileValidationErrors.length > 0) {
                throw createValidationError(fileValidationErrors[0].message, fileValidationErrors);
            }

            const validated = submitRequestSchema.parse(normalizedFields);
            const createdRequest = await service.submitRequest(validated, actor);

            const updatedRequest = await service.uploadInvoiceToRequest(createdRequest.id, file, actor);
            return { data: updatedRequest };
        } catch (err) {
            handleError(reply, err);
        }
    });

    // Get My Requests
    app.get("/my-requests", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const validated = listRequestsQuerySchema.parse(request.query);
            const { page, perPage, ...filters } = validated;
            const result = await service.getMyRequests(actor, filters, { page, perPage });
            const totalPages = Math.max(1, Math.ceil(result.total / result.perPage));
            return { data: result.data, meta: { total: result.total, page: result.page, perPage: result.perPage, totalPages } };
        } catch (err) {
            handleError(reply, err);
        }
    });

    // Get All Requests (IT/Admin)
    app.get("/", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const validated = listRequestsQuerySchema.parse(request.query);
            const { page, perPage, ...filters } = validated;
            const result = await service.getAllRequests(filters, { page, perPage }, actor);
            const totalPages = Math.max(1, Math.ceil(result.total / result.perPage));
            return { data: result.data, meta: { total: result.total, page: result.page, perPage: result.perPage, totalPages } };
        } catch (err) {
            handleError(reply, err);
        }
    });

    // Get Request Details
    app.get("/:id", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const { id } = requestIdParamSchema.parse(request.params);
            const result = await service.getRequestDetails(id, actor);
            if (!result) {
                return sendProblem(reply, createProblemDetails({ status: 404, title: "Not Found", detail: "Request not found" }));
            }
            return { data: result };
        } catch (err) {
            handleError(reply, err);
        }
    });

    // Upload Invoice to Request
    app.post("/:id/invoice", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const { id } = uploadInvoiceParamsSchema.parse(request.params);

            // Get multipart file first (cannot be parsed by Zod obviously)
            const data = await request.file();

            if (!data) {
                return sendProblem(reply, createProblemDetails({
                    status: 400,
                    title: "Bad Request",
                    detail: "No file uploaded"
                }));
            }

            // Convert stream to buffer
            const chunks = [];
            for await (const chunk of data.file) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            const file = {
                filename: data.filename,
                mimetype: data.mimetype,
                size: buffer.length,
                buffer
            };

            const result = await service.uploadInvoiceToRequest(
                id,
                file,
                actor
            );

            return { data: result };
        } catch (err) {
            handleError(reply, err);
        }
    });

    // IT Review
    app.post("/:id/it-review", async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const { id } = requestIdParamSchema.parse(request.params);
            const validated = itReviewSchema.parse(request.body);

            const result = await service.itReviewRequest(id, validated, actor);
            return { data: result };
        } catch (err) {
            handleError(reply, err);
        }
    });

    // Mark as Already Purchased
    app.post("/:id/already-purchased", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const { id } = requestIdParamSchema.parse(request.params);
            const validated = alreadyPurchasedSchema.parse(request.body);

            const result = await service.markAlreadyPurchased(id, validated.reason, actor);
            return { data: result };
        } catch (err) {
            handleError(reply, err);
        }
    });

    // Reject Request
    app.post("/:id/reject", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const { id } = requestIdParamSchema.parse(request.params);
            const validated = rejectRequestSchema.parse(request.body);

            const result = await service.rejectRequest(id, validated.rejectionReason, actor);
            return { data: result };
        } catch (err) {
            handleError(reply, err);
        }
    });

    // Admin Approval
    app.post("/:id/approve", async (request, reply) => {
        const actor = await requireAdminOrHead(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const { id } = requestIdParamSchema.parse(request.params);

            const result = await service.approveRequest(id, actor);
            return { data: result };
        } catch (err) {
            handleError(reply, err);
        }
    });
}
