import { z } from "zod";
import { requireAuthenticated } from "../../shared/auth/requireAuthenticated.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";
import { previewRequestSchema, confirmCredentialsSchema, regenerateRequestSchema, confirmRegenerationSchema } from "./schema.js";
import { DisabledUserError, NoChangesDetectedError } from "./service.js";

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

    // Credential Regeneration Routes (Story 2.4)

    // POST /api/v1/users/:userId/credentials/regenerate - Initiate regeneration
    app.post("/users/:userId/regenerate", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can regenerate credentials"
            }));
            return;
        }

        // Validate request body
        const validation = regenerateRequestSchema.safeParse(request.body || {});
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
            // Preview the regeneration with comparison
            const preview = await credentialService.previewCredentialRegeneration(userId);

            // Store in preview session
            const previewToken = await credentialService.storeRegenerationPreview(userId, preview);

            // Audit log the regeneration initiation
            if (auditRepo) {
                await auditRepo.createAuditLog({
                    action: "credentials.regenerate.initiate",
                    actorUserId: actor.id,
                    entityType: "UserCredential",
                    entityId: userId,
                    metadata: {
                        changeType: preview.changeType,
                        changedLdapFields: preview.changedLdapFields,
                        oldTemplateVersion: preview.oldTemplateVersion,
                        newTemplateVersion: preview.newTemplateVersion
                    }
                });
            }

            reply.send({
                data: {
                    userId: preview.userId,
                    changeType: preview.changeType,
                    changedLdapFields: preview.changedLdapFields,
                    oldTemplateVersion: preview.oldTemplateVersion,
                    newTemplateVersion: preview.newTemplateVersion,
                    comparisons: preview.comparisons,
                    previewToken: previewToken,
                    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
                }
            });
        } catch (error) {
            // Handle disabled user error
            if (error instanceof DisabledUserError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/regeneration-blocked',
                    status: 403,
                    title: "Regeneration Blocked",
                    detail: "Cannot regenerate credentials for disabled users",
                    userId: error.userId,
                    userStatus: "disabled",
                    resolution: "Re-enable the user before regenerating credentials"
                }));
                
                // Audit log the blocked attempt
                if (auditRepo) {
                    await auditRepo.createAuditLog({
                        action: "credentials.regenerate.blocked",
                        actorUserId: actor.id,
                        entityType: "UserCredential",
                        entityId: userId,
                        metadata: {
                            reason: "user_disabled",
                            userStatus: "disabled"
                        }
                    });
                }
                return;
            }

            // Handle no changes detected error
            if (error instanceof NoChangesDetectedError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/no-changes-detected',
                    status: 400,
                    title: "No Changes Detected",
                    detail: "LDAP data and template are unchanged since last generation",
                    lastGeneratedAt: error.lastGeneratedAt,
                    suggestion: "Credentials are already up-to-date"
                }));
                return;
            }

            // Handle missing LDAP fields error
            if (error.code === 'MISSING_LDAP_FIELDS') {
                sendProblem(reply, createProblemDetails({
                    ...error.problemDetails,
                    status: 422,
                    title: "Credential Generation Failed",
                    detail: "Required LDAP fields are missing for credential regeneration"
                }));
                return;
            }

            console.error('Credential regeneration error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Regeneration Failed",
                detail: error.message || "Failed to regenerate credentials"
            }));
        }
    });

    // POST /api/v1/users/:userId/credentials/regenerate/preview - Get preview (alternative endpoint)
    app.post("/users/:userId/regenerate/preview", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can preview credential regeneration"
            }));
            return;
        }

        const { userId } = request.params;

        try {
            // This endpoint is identical to /regenerate but explicit about preview purpose
            const preview = await credentialService.previewCredentialRegeneration(userId);
            const previewToken = await credentialService.storeRegenerationPreview(userId, preview);

            reply.send({
                data: {
                    userId: preview.userId,
                    changeType: preview.changeType,
                    changedLdapFields: preview.changedLdapFields,
                    oldTemplateVersion: preview.oldTemplateVersion,
                    newTemplateVersion: preview.newTemplateVersion,
                    comparisons: preview.comparisons,
                    previewToken: previewToken,
                    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
                }
            });
        } catch (error) {
            // Handle errors same as /regenerate endpoint
            if (error instanceof DisabledUserError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/regeneration-blocked',
                    status: 403,
                    title: "Regeneration Blocked",
                    detail: "Cannot regenerate credentials for disabled users",
                    userId: error.userId,
                    userStatus: "disabled",
                    resolution: "Re-enable the user before regenerating credentials"
                }));
                return;
            }

            if (error instanceof NoChangesDetectedError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/no-changes-detected',
                    status: 400,
                    title: "No Changes Detected",
                    detail: "LDAP data and template are unchanged since last generation",
                    lastGeneratedAt: error.lastGeneratedAt,
                    suggestion: "Credentials are already up-to-date"
                }));
                return;
            }

            if (error.code === 'MISSING_LDAP_FIELDS') {
                sendProblem(reply, createProblemDetails({
                    ...error.problemDetails,
                    status: 422
                }));
                return;
            }

            console.error('Credential regeneration preview error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Preview Failed",
                detail: error.message || "Failed to preview credential regeneration"
            }));
        }
    });

    // POST /api/v1/users/:userId/credentials/regenerate/confirm - Confirm and execute regeneration
    app.post("/users/:userId/regenerate/confirm", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can confirm credential regeneration"
            }));
            return;
        }

        // Validate request body
        const validation = confirmRegenerationSchema.safeParse(request.body);
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
                detail: "You must explicitly confirm the credential regeneration before proceeding."
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
                    detail: "The regeneration preview session has expired. Please start again.",
                    expiredAt: new Date().toISOString()
                }));
                return;
            }

            // Verify it's a regeneration session
            if (previewSession.type !== 'regeneration') {
                sendProblem(reply, createProblemDetails({
                    status: 400,
                    title: "Invalid Preview Token",
                    detail: "The preview token is not valid for regeneration."
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

            // Execute the regeneration
            const result = await credentialService.confirmRegeneration(actor.id, previewSession);

            // Clean up preview session
            await credentialService.deletePreviewSession(previewToken);

            // Audit log the regeneration completion
            if (auditRepo) {
                await auditRepo.createAuditLog({
                    action: "credentials.regenerate.confirm",
                    actorUserId: actor.id,
                    entityType: "UserCredential",
                    entityId: userId,
                    metadata: {
                        changeType: result.changeType,
                        regeneratedSystems: result.regeneratedCredentials.map(c => c.system),
                        preservedHistory: result.preservedHistory,
                        skippedCredentials: result.skippedCredentials,
                        templateVersion: result.templateVersion
                    }
                });
            }

            reply.code(201).send({
                data: {
                    userId: result.userId,
                    changeType: result.changeType,
                    regeneratedCredentials: result.regeneratedCredentials,
                    preservedHistory: result.preservedHistory,
                    skippedCredentials: result.skippedCredentials,
                    templateVersion: result.templateVersion,
                    performedBy: result.performedBy,
                    performedAt: result.performedAt
                }
            });
        } catch (error) {
            console.error('Confirm regeneration error:', error);
            
            // Handle disabled user error during confirmation
            if (error instanceof DisabledUserError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/regeneration-blocked',
                    status: 403,
                    title: "Regeneration Blocked",
                    detail: "User was disabled during the regeneration process",
                    userId: error.userId,
                    userStatus: "disabled"
                }));
                return;
            }

            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Regenerate Credentials",
                detail: error.message || "Failed to complete credential regeneration"
            }));
        }
    });
}
