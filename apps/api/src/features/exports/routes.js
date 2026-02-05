import { z } from "zod";
import { requireAuthenticated } from "../../shared/auth/requireAuthenticated.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";
import { exportUserCredentialsParamsSchema } from "./schema.js";
import { exportUserCredentials, DisabledUserError } from "./service.js";
import { hasItRole } from "../../shared/auth/rbac.js";

export default async function exportRoutes(app, { config, userRepo }) {

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

    const validation = exportUserCredentialsParamsSchema.safeParse(request.params);
    if (!validation.success) {
      sendProblem(reply, createProblemDetails({
        status: 400,
        title: "Bad Request",
        detail: "Invalid userId format",
        issues: validation.error.issues
      }));
      return;
    }

    const { userId } = validation.data;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      
      const exportContent = await exportUserCredentials(userId, actor.id);

      reply
        .header('Content-Type', 'text/plain; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="credentials-${userId}-${timestamp}.txt"`)
        .header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
        .header('X-Content-Type-Options', 'nosniff')
        .header('X-Frame-Options', 'DENY')
        .header('Pragma', 'no-cache')
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
}
