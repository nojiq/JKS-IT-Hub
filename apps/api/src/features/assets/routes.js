import { requireAuthenticated } from "../../shared/auth/requireAuthenticated.js";
import { requireItUser } from "../../shared/auth/requireItUser.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";
import { linkUserSchema, listAssetsQuerySchema } from "./schema.js";

const sendValidationError = (reply, error) => sendProblem(reply, createProblemDetails({
  status: 400,
  title: "Invalid Input",
  detail: error.issues?.[0]?.message ?? "Invalid request"
}));

const sendServiceError = (reply, error) => {
  const status = error.statusCode ?? 500;
  sendProblem(reply, createProblemDetails({
    status,
    title: status === 404 ? "Not Found" : "Asset Error",
    detail: error.message
  }));
};

export default async function assetsRoutes(app, { config, userRepo, assetService, auditRepo }) {
  app.get("/", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;

    const validation = listAssetsQuerySchema.safeParse(request.query ?? {});
    if (!validation.success) {
      sendValidationError(reply, validation.error);
      return;
    }

    const { page, perPage, ...filters } = validation.data;
    const result = await assetService.listAssets(filters, { page, perPage });
    return {
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        perPage: result.perPage
      }
    };
  });

  app.get("/meta", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    return { data: await assetService.getFilterOptions() };
  });

  app.get("/sync/status", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    return { data: await assetService.getSyncStatus() };
  });

  app.post("/sync", async (request, reply) => {
    const actor = await requireItUser(request, reply, { config, userRepo });
    if (!actor) return;
    if (!assetService.isEnabled()) {
      sendProblem(reply, createProblemDetails({
        status: 503,
        title: "Snipe-IT Sync Unavailable",
        detail: "Snipe-IT sync is not configured."
      }));
      return;
    }

    try {
      const data = await assetService.syncAssets({ triggeredByUserId: actor.id });
      await auditRepo?.createAuditLog?.({
        action: "assets.sync",
        actorUserId: actor.id,
        entityType: "asset_sync",
        entityId: "manual",
        metadata: data
      }).catch(() => {});
      return { data };
    } catch (error) {
      sendServiceError(reply, error);
    }
  });

  app.get("/:id", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;

    const asset = await assetService.getAsset(request.params.id);
    if (!asset) {
      sendProblem(reply, createProblemDetails({
        status: 404,
        title: "Not Found",
        detail: "Asset not found"
      }));
      return;
    }

    return { data: asset };
  });

  app.patch("/:id/link-user", async (request, reply) => {
    const actor = await requireItUser(request, reply, { config, userRepo });
    if (!actor) return;

    const validation = linkUserSchema.safeParse(request.body ?? {});
    if (!validation.success) {
      sendValidationError(reply, validation.error);
      return;
    }

    try {
      const data = await assetService.linkAssetToUser(request.params.id, validation.data.userId, actor);
      await auditRepo?.createAuditLog?.({
        action: "assets.link_user",
        actorUserId: actor.id,
        entityType: "asset",
        entityId: request.params.id,
        metadata: { userId: validation.data.userId }
      }).catch(() => {});
      return { data };
    } catch (error) {
      sendServiceError(reply, error);
    }
  });

  app.delete("/:id/link-user", async (request, reply) => {
    const actor = await requireItUser(request, reply, { config, userRepo });
    if (!actor) return;

    try {
      const data = await assetService.clearAssetLink(request.params.id, actor);
      await auditRepo?.createAuditLog?.({
        action: "assets.clear_link",
        actorUserId: actor.id,
        entityType: "asset",
        entityId: request.params.id,
        metadata: { assignmentSource: data.assignmentSource, assignedToUserId: data.assignedToUserId }
      }).catch(() => {});
      return { data };
    } catch (error) {
      sendServiceError(reply, error);
    }
  });
}
