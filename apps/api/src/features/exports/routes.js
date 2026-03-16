import { requireAuthenticated } from "../../shared/auth/requireAuthenticated.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";
import { exportUserCredentialsParamsSchema, batchExportSchema } from "./schema.js";
import * as defaultExportService from "./service.js";
import { getExportFormat } from "./config.js";
import { hasItRole } from "../../shared/auth/rbac.js";

const extractBatchIdFromExport = (exportContent, format) => {
  if (!exportContent || typeof exportContent !== "string") {
    return null;
  }

  if (format === "compressed") {
    const [headerLine] = exportContent.split("\n");
    const parts = headerLine?.split("|");
    return parts?.[4] ?? null;
  }

  const match = exportContent.match(/^Batch ID:\s*(.+)$/m);
  return match?.[1]?.trim() || null;
};

const sanitizeFilenamePart = (value) =>
  String(value).replace(/[^a-zA-Z0-9._-]/g, "-");

export default async function exportRoutes(app, { config, userRepo, exportService = defaultExportService }) {
  const {
    exportUserCredentials,
    exportBatchCredentials,
    DisabledUserError
  } = exportService;

  app.get("/users/:userId/credentials/export", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;

    if (!hasItRole(actor)) {
      sendProblem(reply, createProblemDetails({
        status: 403,
        title: "Unauthorized",
        detail: "IT role required to export credentials",
        requiredRole: "it",
        actualRole: actor.role,
        suggestion: "Contact IT staff for credential export assistance"
      }));
      return;
    }

    const validation = exportUserCredentialsParamsSchema.safeParse({ ...request.params, ...request.query });
    if (!validation.success) {
      const invalidField = validation.error.issues[0]?.path?.[0];
      const detail = invalidField === 'format'
        ? 'Invalid format parameter. Expected "standard" or "compressed".'
        : invalidField === 'userId'
          ? 'Invalid userId format'
          : 'Invalid request parameters';

      sendProblem(reply, createProblemDetails({
        status: 400,
        title: "Bad Request",
        detail,
        issues: validation.error.issues
      }));
      return;
    }

    const { userId, format } = validation.data;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const formatConfig = getExportFormat(format);

      const exportContent = await exportUserCredentials(userId, actor.id, format);

      reply
        .header('Content-Type', formatConfig.contentType)
        .header('Content-Disposition', `attachment; filename="credentials-${userId}-${timestamp}.${formatConfig.extension}"`)
        .header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
        .header('X-Content-Type-Options', 'nosniff')
        .header('X-Frame-Options', 'DENY')
        .header('Pragma', 'no-cache')
        .header('Expires', '0')
        .send(exportContent);
    } catch (error) {
      if (error.message === 'User not found') {
        sendProblem(reply, createProblemDetails({
          status: 404,
          title: "User Not Found",
          detail: "User with the specified ID does not exist",
          userId
        }));
        return;
      }

      if (error instanceof DisabledUserError) {
        sendProblem(reply, createProblemDetails({
          status: 403,
          title: "User Disabled",
          detail: "Cannot export credentials for disabled user",
          userId,
          suggestion: "Enable user before exporting credentials"
        }));
        return;
      }

      console.error('[Export] Unexpected error:', error);
      sendProblem(reply, createProblemDetails({
        status: 500,
        title: "Internal Server Error",
        detail: "Failed to export credentials"
      }));
    }
  });
  app.post("/credentials/export/batch", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;

    if (!hasItRole(actor)) {
      sendProblem(reply, createProblemDetails({
        status: 403,
        title: "Unauthorized",
        detail: "IT role required to perform batch exports",
        requiredRole: "it",
        actualRole: actor.role,
        suggestion: "Contact IT staff for assistance"
      }));
      return;
    }

    const validation = batchExportSchema.safeParse(request.body);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      const invalidField = firstIssue?.path?.[0];

      let detail = "Invalid batch export request";
      let suggestion;
      let requestedSize;
      let maxSize;

      if (invalidField === "format") {
        detail = 'Invalid format parameter. Expected "standard" or "compressed".';
      } else if (invalidField === "userIds") {
        if (firstIssue?.code === "too_big") {
          requestedSize = Array.isArray(request.body?.userIds) ? request.body.userIds.length : undefined;
          maxSize = 100;
          detail = "Batch export limited to 100 users";
          suggestion = "Break the export into multiple smaller batches.";
        } else if (firstIssue?.code === "too_small") {
          detail = "Batch export requires at least one user ID";
          suggestion = "Provide a non-empty userIds array.";
        } else {
          detail = "Invalid batch export request: userIds must contain 1-100 UUID values.";
        }
      }

      sendProblem(reply, createProblemDetails({
        status: 400,
        title: "Bad Request",
        detail,
        suggestion,
        requestedSize,
        maxSize,
        issues: validation.error.issues
      }));
      return;
    }

    const { userIds, format } = validation.data;

    try {
      const exportContent = await exportBatchCredentials(userIds, actor.id, format);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const batchId = extractBatchIdFromExport(exportContent, format) || "batch";
      const formatConfig = getExportFormat(format);
      const safeBatchId = sanitizeFilenamePart(batchId);

      reply
        .header('Content-Type', formatConfig.contentType)
        .header('Content-Disposition', `attachment; filename="batch-credentials-${safeBatchId}-${timestamp}.${formatConfig.extension}"`)
        .header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
        .header('X-Content-Type-Options', 'nosniff')
        .header('X-Frame-Options', 'DENY')
        .header('Pragma', 'no-cache')
        .header('Expires', '0')
        .send(exportContent);
    } catch (error) {
      console.error('[Batch Export] Unexpected error:', error);
      sendProblem(reply, createProblemDetails({
        status: 500,
        title: "Internal Server Error",
        detail: "Failed to process batch export"
      }));
    }
  });
}
