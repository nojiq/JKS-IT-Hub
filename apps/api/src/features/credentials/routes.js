import { z } from "zod";
import { requireAuthenticated } from "../../shared/auth/requireAuthenticated.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";
import { previewRequestSchema, confirmCredentialsSchema } from "./schema.js";

const createTemplateSchema = z.object({
    name: z.string().min(3).max(100),
    description: z.string().optional(),
    structure: z.record(z.string(), z.any())
});

export default async function credentialRoutes(app, { config, userRepo, credentialService, auditRepo }) {

    app.post("/", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // specific RBAC check: IT roles
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can manage credential templates"
            }));
            return;
        }

        const validation = createTemplateSchema.safeParse(request.body);
        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
            return;
        }

        const template = await credentialService.createTemplate(actor.id, validation.data);

        if (auditRepo) {
            await auditRepo.createAuditLog({
                action: "credential_template.create",
                actorUserId: actor.id,
                entityType: "CredentialTemplate",
                entityId: template.id,
                metadata: { name: template.name, version: template.version }
            });
        }

        reply.code(201).send({ data: template });
    });

    app.get("/", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can view credential templates"
            }));
            return;
        }

        const templates = await credentialService.listTemplates();
        reply.send({ data: templates });
    });

    app.get("/:id", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can view credential templates"
            }));
            return;
        }

        const { id } = request.params;
        const template = await credentialService.getTemplate(id);

        if (!template) {
            sendProblem(reply, createProblemDetails({
                status: 404,
                title: "Not Found",
                detail: "Credential template not found"
            }));
            return;
        }

        reply.send({ data: template });
    });

    app.put("/:id", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can update credential templates"
            }));
            return;
        }

        const { id } = request.params;
        const validation = createTemplateSchema.safeParse(request.body);

        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
            return;
        }

        const template = await credentialService.updateTemplate(actor.id, id, validation.data);

        if (!template) {
            sendProblem(reply, createProblemDetails({
                status: 404,
                title: "Not Found",
                detail: "Credential template not found"
            }));
            return;
        }

        if (auditRepo) {
            await auditRepo.createAuditLog({
                action: "credential_template.update",
                actorUserId: actor.id,
                entityType: "CredentialTemplate",
                entityId: template.id,
                metadata: { name: template.name, version: template.version }
            });
        }

        reply.send({ data: template });
    });

    // Credential Generation Routes

    // POST /api/v1/users/:userId/credentials/generate
    app.post("/users/:userId/generate", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can generate credentials"
            }));
            return;
        }

        const { userId } = request.params;

        try {
            const result = await credentialService.generateUserCredentials(actor.id, userId);

            // Audit log the generation
            if (auditRepo) {
                await auditRepo.createAuditLog({
                    action: "credentials.generate",
                    actorUserId: actor.id,
                    entityType: "UserCredential",
                    entityId: userId,
                    metadata: {
                        systems: result.credentials.map(c => c.system),
                        templateVersion: result.templateVersion,
                        credentialCount: result.credentials.length
                    }
                });
            }

            reply.code(201).send({
                data: {
                    userId: result.userId,
                    credentials: result.credentials,
                    templateVersion: result.templateVersion
                }
            });
        } catch (error) {
            // Handle missing LDAP fields error
            if (error.code === 'MISSING_LDAP_FIELDS') {
                sendProblem(reply, createProblemDetails({
                    ...error.problemDetails,
                    status: 422,
                    title: "Credential Generation Failed",
                    detail: "Required LDAP fields are missing for credential generation"
                }));
                return;
            }

            // Handle other errors
            console.error('Credential generation error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Generation Failed",
                detail: error.message || "Failed to generate credentials"
            }));
        }
    });

    // GET /api/v1/users/:userId/credentials - List user credentials
    app.get("/users/:userId", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can view credentials"
            }));
            return;
        }

        const { userId } = request.params;

        try {
            const credentials = await credentialService.listUserCredentials(userId);

            reply.send({
                data: credentials,
                meta: { count: credentials.length }
            });
        } catch (error) {
            console.error('List credentials error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to List Credentials",
                detail: error.message || "Failed to retrieve credentials"
            }));
        }
    });

    // GET /api/v1/credentials/:id - Get single credential
    app.get("/detail/:id", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can view credentials"
            }));
            return;
        }

        const { id } = request.params;

        try {
            const credential = await credentialService.getUserCredential(id);

            if (!credential) {
                sendProblem(reply, createProblemDetails({
                    status: 404,
                    title: "Not Found",
                    detail: "Credential not found"
                }));
                return;
            }

            reply.send({ data: credential });
        } catch (error) {
            console.error('Get credential error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Retrieve Credential",
                detail: error.message || "Failed to retrieve credential"
            }));
        }
    });

    // GET /api/v1/credentials/:id/versions - Get version history
    app.get("/detail/:id/versions", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can view credential history"
            }));
            return;
        }

        const { id } = request.params;

        try {
            const versions = await credentialService.getCredentialVersionHistory(id);

            reply.send({
                data: versions,
                meta: { count: versions.length }
            });
        } catch (error) {
            console.error('Get credential versions error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Retrieve Versions",
                detail: error.message || "Failed to retrieve credential versions"
            }));
        }
    });

    // POST /api/v1/users/:userId/credentials/preview - Preview credentials without saving
    app.post("/users/:userId/preview", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can preview credentials"
            }));
            return;
        }

        // Validate request body with Zod
        const validation = previewRequestSchema.safeParse(request.body || {});
        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
            return;
        }

        const { userId } = request.params;

        try {
            const preview = await credentialService.previewUserCredentials(userId);

            if (!preview.success) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/credential-preview-failed',
                    status: 422,
                    title: "Credential Preview Failed",
                    detail: preview.error.message,
                    missingFields: preview.error.missingFields,
                    userId: preview.error.userId
                }));
                return;
            }

            // Store preview in session for confirmation
            const previewToken = await credentialService.storePreviewSession(userId, preview);

            reply.send({
                data: {
                    userId: preview.userId,
                    credentials: preview.credentials,
                    templateVersion: preview.templateVersion,
                    previewToken: previewToken,
                    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
                }
            });
        } catch (error) {
            console.error('Preview credentials error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Preview Failed",
                detail: error.message || "Failed to preview credentials"
            }));
        }
    });

    // POST /api/v1/users/:userId/credentials/confirm - Confirm and save previewed credentials
    app.post("/users/:userId/confirm", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can confirm credentials"
            }));
            return;
        }

        // Validate request body with Zod
        const validation = confirmCredentialsSchema.safeParse(request.body);
        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
            return;
        }

        const { userId } = request.params;
        const { previewToken, confirmed } = validation.data;

        // Validate explicit confirmation
        if (!confirmed) {
            sendProblem(reply, createProblemDetails({
                type: '/problems/confirmation-required',
                status: 400,
                title: "Explicit Confirmation Required",
                detail: "You must explicitly confirm the credentials before saving."
            }));
            return;
        }

        try {
            // Retrieve and validate preview session
            const previewSession = await credentialService.getPreviewSession(previewToken);
            
            if (!previewSession) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/preview-expired',
                    status: 410,
                    title: "Preview Session Expired",
                    detail: "The credential preview session has expired. Please generate a new preview.",
                    expiredAt: new Date().toISOString()
                }));
                return;
            }

            // Verify userId matches the preview
            if (previewSession.userId !== userId) {
                sendProblem(reply, createProblemDetails({
                    status: 400,
                    title: "Invalid Preview Token",
                    detail: "The preview token does not match the specified user."
                }));
                return;
            }

            // Save the credentials from preview
            const result = await credentialService.savePreviewedCredentials(actor.id, previewSession);

            // Clean up preview session
            await credentialService.deletePreviewSession(previewToken);

            // Audit log the credential creation
            if (auditRepo) {
                await auditRepo.createAuditLog({
                    action: "credentials.create",
                    actorUserId: actor.id,
                    entityType: "UserCredential",
                    entityId: userId,
                    metadata: {
                        systems: result.credentials.map(c => c.system),
                        templateVersion: result.templateVersion,
                        credentialCount: result.credentials.length,
                        source: "preview-confirmation"
                    }
                });
            }

            reply.code(201).send({
                data: {
                    userId: result.userId,
                    credentials: result.credentials,
                    templateVersion: result.templateVersion
                }
            });
        } catch (error) {
            console.error('Confirm credentials error:', error);
            
            // Handle specific error types
            if (error.code === 'PREVIEW_EXPIRED') {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/preview-expired',
                    status: 410,
                    title: "Preview Session Expired",
                    detail: error.message || "The credential preview session has expired."
                }));
                return;
            }

            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Save Credentials",
                detail: error.message || "Failed to save credentials from preview"
            }));
        }
    });
}
