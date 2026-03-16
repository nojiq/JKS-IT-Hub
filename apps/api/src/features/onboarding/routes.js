import { requireAuthenticated } from "../../shared/auth/requireAuthenticated.js";
import { hasItRole } from "../../shared/auth/rbac.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";
import {
  confirmOnboardingSchema,
  createCatalogItemSchema,
  createDepartmentBundleSchema,
  linkOnboardingDraftSchema,
  listOnboardingDraftsSchema,
  listDirectoryUsersSchema,
  previewOnboardingSchema,
  updateCatalogItemSchema,
  updateDepartmentBundleSchema
} from "./schema.js";
import { OnboardingNotFoundError, OnboardingValidationError } from "./errors.js";

const ensureItRole = (actor, reply) => {
  if (hasItRole(actor)) {
    return true;
  }

  sendProblem(
    reply,
    createProblemDetails({
      status: 403,
      title: "Forbidden",
      detail: "Only IT roles can manage onboarding"
    })
  );
  return false;
};

const formatValidationIssues = (validation) => {
  return validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
};

const handleOnboardingError = (error, reply) => {
  if (error instanceof OnboardingNotFoundError) {
    sendProblem(
      reply,
      createProblemDetails({
        status: 404,
        title: "Not Found",
        detail: error.message
      })
    );
    return;
  }

  if (error instanceof OnboardingValidationError) {
    sendProblem(
      reply,
      createProblemDetails({
        status: 400,
        title: "Invalid Input",
        detail: error.message,
        ...error.details
      })
    );
    return;
  }

  if (error?.code === "P2002") {
    sendProblem(
      reply,
      createProblemDetails({
        status: 409,
        title: "Conflict",
        detail: "A record with the same unique value already exists"
      })
    );
    return;
  }

  if (error?.code === "P2025") {
    sendProblem(
      reply,
      createProblemDetails({
        status: 404,
        title: "Not Found",
        detail: "The requested onboarding record no longer exists"
      })
    );
    return;
  }

  console.error("Onboarding route error:", error);
  sendProblem(
    reply,
    createProblemDetails({
      status: 500,
      title: "Onboarding request failed",
      detail: error.message || "Unexpected onboarding error"
    })
  );
};

export default async function onboardingRoutes(app, { config, userRepo, onboardingService, auditRepo }) {
  app.get("/catalog-items", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    if (!ensureItRole(actor, reply)) return;

    try {
      const items = await onboardingService.listCatalogItems();
      reply.send({ data: items });
    } catch (error) {
      handleOnboardingError(error, reply);
    }
  });

  app.post("/catalog-items", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    if (!ensureItRole(actor, reply)) return;

    const validation = createCatalogItemSchema.safeParse(request.body);
    if (!validation.success) {
      sendProblem(
        reply,
        createProblemDetails({
          status: 400,
          title: "Invalid Input",
          detail: formatValidationIssues(validation)
        })
      );
      return;
    }

    try {
      const item = await onboardingService.createCatalogItem(validation.data, actor.id);
      if (auditRepo?.createAuditLog) {
        await auditRepo.createAuditLog({
          action: "onboarding.catalog_item.create",
          actorUserId: actor.id,
          entityType: "OnboardingCatalogItem",
          entityId: item.id,
          metadata: { itemKey: item.itemKey }
        });
      }
      reply.code(201).send({ data: item });
    } catch (error) {
      handleOnboardingError(error, reply);
    }
  });

  app.put("/catalog-items/:id", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    if (!ensureItRole(actor, reply)) return;

    const validation = updateCatalogItemSchema.safeParse(request.body);
    if (!validation.success) {
      sendProblem(
        reply,
        createProblemDetails({
          status: 400,
          title: "Invalid Input",
          detail: formatValidationIssues(validation)
        })
      );
      return;
    }

    try {
      const item = await onboardingService.updateCatalogItem(request.params.id, validation.data);
      reply.send({ data: item });
    } catch (error) {
      handleOnboardingError(error, reply);
    }
  });

  app.delete("/catalog-items/:id", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    if (!ensureItRole(actor, reply)) return;

    try {
      const result = await onboardingService.deleteCatalogItem(request.params.id);
      reply.send({ data: result });
    } catch (error) {
      handleOnboardingError(error, reply);
    }
  });

  app.get("/department-bundles", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    if (!ensureItRole(actor, reply)) return;

    try {
      const bundles = await onboardingService.listDepartmentBundles();
      reply.send({ data: bundles });
    } catch (error) {
      handleOnboardingError(error, reply);
    }
  });

  app.post("/department-bundles", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    if (!ensureItRole(actor, reply)) return;

    const validation = createDepartmentBundleSchema.safeParse(request.body);
    if (!validation.success) {
      sendProblem(
        reply,
        createProblemDetails({
          status: 400,
          title: "Invalid Input",
          detail: formatValidationIssues(validation)
        })
      );
      return;
    }

    try {
      const bundle = await onboardingService.createDepartmentBundle(validation.data, actor.id);
      reply.code(201).send({ data: bundle });
    } catch (error) {
      handleOnboardingError(error, reply);
    }
  });

  app.put("/department-bundles/:id", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    if (!ensureItRole(actor, reply)) return;

    const validation = updateDepartmentBundleSchema.safeParse(request.body);
    if (!validation.success) {
      sendProblem(
        reply,
        createProblemDetails({
          status: 400,
          title: "Invalid Input",
          detail: formatValidationIssues(validation)
        })
      );
      return;
    }

    try {
      const bundle = await onboardingService.updateDepartmentBundle(request.params.id, validation.data);
      reply.send({ data: bundle });
    } catch (error) {
      handleOnboardingError(error, reply);
    }
  });

  app.delete("/department-bundles/:id", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    if (!ensureItRole(actor, reply)) return;

    try {
      const result = await onboardingService.deleteDepartmentBundle(request.params.id);
      reply.send({ data: result });
    } catch (error) {
      handleOnboardingError(error, reply);
    }
  });

  app.get("/departments", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    if (!ensureItRole(actor, reply)) return;

    try {
      const departments = await onboardingService.listManagedDepartments();
      reply.send({ data: departments });
    } catch (error) {
      handleOnboardingError(error, reply);
    }
  });

  app.get("/directory-users", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    if (!ensureItRole(actor, reply)) return;

    const validation = listDirectoryUsersSchema.safeParse(request.query ?? {});
    if (!validation.success) {
      sendProblem(
        reply,
        createProblemDetails({
          status: 400,
          title: "Invalid Input",
          detail: formatValidationIssues(validation)
        })
      );
      return;
    }

    try {
      const users = await onboardingService.listDirectoryUsers(validation.data);
      reply.send({ data: users });
    } catch (error) {
      handleOnboardingError(error, reply);
    }
  });

  app.get("/drafts/:id", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    if (!ensureItRole(actor, reply)) return;

    try {
      const draft = await onboardingService.getOnboardingDraft(request.params.id);
      reply.send({ data: draft });
    } catch (error) {
      handleOnboardingError(error, reply);
    }
  });

  app.get("/drafts", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    if (!ensureItRole(actor, reply)) return;

    const validation = listOnboardingDraftsSchema.safeParse(request.query ?? {});
    if (!validation.success) {
      sendProblem(
        reply,
        createProblemDetails({
          status: 400,
          title: "Invalid Input",
          detail: formatValidationIssues(validation)
        })
      );
      return;
    }

    try {
      const drafts = await onboardingService.listOnboardingDrafts(validation.data);
      reply.send({ data: drafts });
    } catch (error) {
      handleOnboardingError(error, reply);
    }
  });

  app.post("/drafts/:id/link", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    if (!ensureItRole(actor, reply)) return;

    const validation = linkOnboardingDraftSchema.safeParse(request.body);
    if (!validation.success) {
      sendProblem(
        reply,
        createProblemDetails({
          status: 400,
          title: "Invalid Input",
          detail: formatValidationIssues(validation)
        })
      );
      return;
    }

    try {
      const linkedDraft = await onboardingService.linkDraftToUser(request.params.id, validation.data.userId);
      reply.send({ data: linkedDraft });
    } catch (error) {
      handleOnboardingError(error, reply);
    }
  });

  app.post("/drafts/:id/link-and-promote", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    if (!ensureItRole(actor, reply)) return;

    const validation = linkOnboardingDraftSchema.safeParse(request.body);
    if (!validation.success) {
      sendProblem(
        reply,
        createProblemDetails({
          status: 400,
          title: "Invalid Input",
          detail: formatValidationIssues(validation)
        })
      );
      return;
    }

    try {
      const result = await onboardingService.linkDraftToUserAndPromote(
        request.params.id,
        validation.data.userId,
        { performedByUserId: actor.id }
      );
      reply.send({ data: result });
    } catch (error) {
      handleOnboardingError(error, reply);
    }
  });

  app.post("/preview", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    if (!ensureItRole(actor, reply)) return;

    const validation = previewOnboardingSchema.safeParse(request.body);
    if (!validation.success) {
      sendProblem(
        reply,
        createProblemDetails({
          status: 400,
          title: "Invalid Input",
          detail: formatValidationIssues(validation)
        })
      );
      return;
    }

    try {
      const preview = await onboardingService.previewOnboardingSetup(validation.data);
      reply.send({ data: preview });
    } catch (error) {
      handleOnboardingError(error, reply);
    }
  });

  app.post("/confirm", async (request, reply) => {
    const actor = await requireAuthenticated(request, reply, { config, userRepo });
    if (!actor) return;
    if (!ensureItRole(actor, reply)) return;

    const validation = confirmOnboardingSchema.safeParse(request.body);
    if (!validation.success) {
      sendProblem(
        reply,
        createProblemDetails({
          status: 400,
          title: "Invalid Input",
          detail: formatValidationIssues(validation)
        })
      );
      return;
    }

    try {
      const result = await onboardingService.confirmOnboardingSetup(actor.id, validation.data);
      reply.send({ data: result });
    } catch (error) {
      handleOnboardingError(error, reply);
    }
  });
}
