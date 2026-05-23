import { requireAuthenticated } from "../../shared/auth/requireAuthenticated.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";
import {
  listIpInventoryQuerySchema,
  manualIpCreateSchema,
  manualIpUpdateSchema,
  subnetCreateSchema,
  subnetUpdateSchema
} from "./schema.js";

const sendValidationError = (reply, error) => sendProblem(reply, createProblemDetails({
  status: 400,
  title: "Invalid Input",
  detail: error.issues?.[0]?.message ?? "Invalid request"
}));

const sendServiceError = (reply, error) => {
  const status = error.statusCode ?? 500;
  const problem = createProblemDetails({
    status,
    title: status === 404 ? "Not Found" : status === 409 ? "Conflict" : "IP List Error",
    type: error.type,
    detail: error.message
  });
  if (error.existing) problem.existing = error.existing;
  if (error.redirectTo) problem.redirectTo = error.redirectTo;
  sendProblem(reply, problem);
};

export default async function ipListRoutes(app, { config, userRepo, ipListService, auditRepo }) {
  const requireActor = (request, reply) => requireAuthenticated(request, reply, { config, userRepo });

  app.get("/", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const validation = listIpInventoryQuerySchema.safeParse(request.query ?? {});
    if (!validation.success) return sendValidationError(reply, validation.error);

    return { data: await ipListService.listInventory(validation.data) };
  });

  app.get("/subnets", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;
    return { data: await ipListService.listSubnetRules() };
  });

  app.post("/subnets", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const validation = subnetCreateSchema.safeParse(request.body ?? {});
    if (!validation.success) return sendValidationError(reply, validation.error);

    try {
      const data = await ipListService.createSubnetRule(validation.data, actor);
      await auditRepo?.createAuditLog?.({
        action: "ip_list.subnet.create",
        actorUserId: actor.id,
        entityType: "ip_subnet_rule",
        entityId: data.id,
        metadata: { cidr: data.cidr, purpose: data.purpose }
      }).catch(() => {});
      reply.code(201);
      return { data };
    } catch (error) {
      sendServiceError(reply, error);
    }
  });

  app.patch("/subnets/:id", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const validation = subnetUpdateSchema.safeParse(request.body ?? {});
    if (!validation.success) return sendValidationError(reply, validation.error);

    try {
      const data = await ipListService.updateSubnetRule(request.params.id, validation.data, actor);
      await auditRepo?.createAuditLog?.({
        action: "ip_list.subnet.update",
        actorUserId: actor.id,
        entityType: "ip_subnet_rule",
        entityId: data.id,
        metadata: { cidr: data.cidr, purpose: data.purpose }
      }).catch(() => {});
      return { data };
    } catch (error) {
      sendServiceError(reply, error);
    }
  });

  app.delete("/subnets/:id", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    try {
      const data = await ipListService.deleteSubnetRule(request.params.id);
      await auditRepo?.createAuditLog?.({
        action: "ip_list.subnet.delete",
        actorUserId: actor.id,
        entityType: "ip_subnet_rule",
        entityId: data.id,
        metadata: { cidr: data.cidr }
      }).catch(() => {});
      return { data };
    } catch (error) {
      sendServiceError(reply, error);
    }
  });

  app.post("/manual-records", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const validation = manualIpCreateSchema.safeParse(request.body ?? {});
    if (!validation.success) return sendValidationError(reply, validation.error);

    try {
      const data = await ipListService.createManualRecord(validation.data, actor);
      await auditRepo?.createAuditLog?.({
        action: "ip_list.manual.create",
        actorUserId: actor.id,
        entityType: "manual_ip_record",
        entityId: data.id,
        metadata: { ipAddress: data.ipAddress, hostname: data.hostname }
      }).catch(() => {});
      reply.code(201);
      return { data };
    } catch (error) {
      sendServiceError(reply, error);
    }
  });

  app.patch("/manual-records/:id", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    const validation = manualIpUpdateSchema.safeParse(request.body ?? {});
    if (!validation.success) return sendValidationError(reply, validation.error);

    try {
      const data = await ipListService.updateManualRecord(request.params.id, validation.data, actor);
      await auditRepo?.createAuditLog?.({
        action: "ip_list.manual.update",
        actorUserId: actor.id,
        entityType: "manual_ip_record",
        entityId: data.id,
        metadata: { ipAddress: data.ipAddress, hostname: data.hostname }
      }).catch(() => {});
      return { data };
    } catch (error) {
      sendServiceError(reply, error);
    }
  });

  app.delete("/manual-records/:id", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    try {
      const data = await ipListService.deleteManualRecord(request.params.id);
      await auditRepo?.createAuditLog?.({
        action: "ip_list.manual.delete",
        actorUserId: actor.id,
        entityType: "manual_ip_record",
        entityId: data.id,
        metadata: { ipAddress: data.ipAddress }
      }).catch(() => {});
      return { data };
    } catch (error) {
      sendServiceError(reply, error);
    }
  });

  app.get("/:ipAddress", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;

    try {
      return { data: await ipListService.getIpDetail(request.params.ipAddress) };
    } catch (error) {
      sendServiceError(reply, error);
    }
  });
}
