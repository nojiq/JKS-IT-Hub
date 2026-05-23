import { requireActiveUser } from "../../shared/auth/requireActiveUser.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";
import { validateInvoiceFile } from "../../shared/uploads/validation.js";
import { ensureUploadDir, generateFileName, saveFile } from "../../shared/uploads/storage.js";
import {
  createPurchaseRecordSchema,
  listPurchaseRecordsQuerySchema,
  marketplacePreviewSchema,
  purchaseRecordIdParamSchema,
  purchaseRecordItemParamSchema,
  verifySnipeSchema
} from "./schema.js";
import { assertSupportedMarketplaceUrl, createPreviewRateLimiter } from "./marketplace.js";

const handleError = (reply, error) => {
  const toErrors = () => {
    if (error?.name === "ZodError" && Array.isArray(error.issues)) {
      return error.issues.map((issue) => ({
        field: issue.path?.join(".") || "body",
        message: issue.message
      }));
    }
    if (Array.isArray(error?.errors)) return error.errors;
    return [{ field: "body", message: error.message }];
  };

  if (error.name === "Forbidden") {
    return sendProblem(reply, createProblemDetails({ status: 403, title: "Forbidden", detail: error.message }));
  }
  if (error.name === "NotFound") {
    return sendProblem(reply, createProblemDetails({ status: 404, title: "Not Found", detail: error.message }));
  }
  if (error.name === "TooManyRequests") {
    return sendProblem(reply, createProblemDetails({ status: 429, title: "Too Many Requests", detail: error.message }));
  }
  if (error.name === "ServiceUnavailable") {
    return sendProblem(reply, createProblemDetails({ status: 503, title: "Service Unavailable", detail: error.message }));
  }
  if (error.name === "ZodError" || error.name === "ValidationError") {
    return sendProblem(reply, createProblemDetails({
      type: "/problems/validation-error",
      status: 400,
      title: "Validation Error",
      detail: error.name === "ZodError" ? "Request validation failed." : error.message,
      errors: toErrors()
    }));
  }

  console.error("Purchase record API error:", error);
  return sendProblem(reply, createProblemDetails({ status: 500, title: "Internal Server Error", detail: error.message }));
};

const parseMultipart = async (request) => {
  const fields = {};
  let file = null;

  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (part.fieldname !== "invoice" || file) {
        for await (const _chunk of part.file) {}
        continue;
      }
      const chunks = [];
      for await (const chunk of part.file) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      file = { filename: part.filename, mimetype: part.mimetype, size: buffer.length, buffer };
      continue;
    }
    fields[part.fieldname] = part.value;
  }

  return { fields, file };
};

const normalizeFields = (fields) => {
  const data = { ...fields };
  if (data.itemsJson) {
    data.items = JSON.parse(data.itemsJson);
    delete data.itemsJson;
  }
  for (const key of Object.keys(data)) {
    if (data[key] === "") delete data[key];
  }
  return data;
};

const saveOptionalInvoice = async (file) => {
  if (!file) return null;
  const validationErrors = validateInvoiceFile(file);
  if (validationErrors.length > 0) {
    const error = new Error(validationErrors[0].message);
    error.name = "ValidationError";
    error.errors = validationErrors;
    throw error;
  }
  await ensureUploadDir();
  const fileName = generateFileName(file.filename);
  await saveFile(file.buffer, fileName);
  return `/api/v1/uploads/${fileName}`;
};

export default async function purchaseRecordsRoutes(app, { config, userRepo, purchaseRecordsService, marketplacePreviewService }) {
  const previewRateLimiter = createPreviewRateLimiter();

  app.post("/", async (request, reply) => {
    const actor = await requireActiveUser(request, reply, { config, userRepo });
    if (!actor) return;

    try {
      const { fields, file } = request.isMultipart()
        ? await parseMultipart(request)
        : { fields: request.body ?? {}, file: null };
      const invoiceFileUrl = await saveOptionalInvoice(file);
      const validated = createPurchaseRecordSchema.parse({
        ...normalizeFields(fields),
        ...(invoiceFileUrl && { invoiceFileUrl })
      });
      const result = await purchaseRecordsService.createPurchaseRecord({ ...validated, invoiceFileUrl }, actor);
      return { data: result };
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.post("/marketplace-preview", async (request, reply) => {
    const actor = await requireActiveUser(request, reply, { config, userRepo });
    if (!actor) return;

    try {
      const { url } = marketplacePreviewSchema.parse(request.body ?? {});
      assertSupportedMarketplaceUrl(url);
      previewRateLimiter.check(actor.id);
      const result = await marketplacePreviewService.preview(url, actor);
      return { data: result };
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.get("/", async (request, reply) => {
    const actor = await requireActiveUser(request, reply, { config, userRepo });
    if (!actor) return;

    try {
      const { page, perPage, ...filters } = listPurchaseRecordsQuerySchema.parse(request.query ?? {});
      const result = await purchaseRecordsService.listPurchaseRecords(filters, { page, perPage }, actor);
      return {
        data: result.data,
        meta: {
          total: result.total,
          page: result.page,
          perPage: result.perPage,
          totalPages: Math.max(1, Math.ceil(result.total / result.perPage))
        }
      };
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.get("/:id", async (request, reply) => {
    const actor = await requireActiveUser(request, reply, { config, userRepo });
    if (!actor) return;

    try {
      const { id } = purchaseRecordIdParamSchema.parse(request.params);
      const result = await purchaseRecordsService.getPurchaseRecordDetails(id, actor);
      if (!result) {
        return sendProblem(reply, createProblemDetails({ status: 404, title: "Not Found", detail: "Purchase record not found" }));
      }
      return { data: result };
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.post("/:recordId/items/:itemId/verify-snipe", async (request, reply) => {
    const actor = await requireActiveUser(request, reply, { config, userRepo });
    if (!actor) return;

    try {
      const { recordId, itemId } = purchaseRecordItemParamSchema.parse(request.params);
      const payload = verifySnipeSchema.parse(request.body ?? {});
      const result = await purchaseRecordsService.verifyPurchaseRecordItemInSnipe(recordId, itemId, payload, actor);
      return { data: result };
    } catch (error) {
      return handleError(reply, error);
    }
  });
}
