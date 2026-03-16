import { requireAuthenticated } from "../../shared/auth/requireAuthenticated.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";
import {
    createTemplateSchema,
    updateTemplateSchema,
    previewRequestSchema,
    confirmCredentialsSchema,
    regenerateRequestSchema,
    confirmRegenerationSchema,
    overridePreviewSchema,
    confirmOverrideSchema,
    lockCredentialSchema,
    unlockCredentialSchema,
    historyQuerySchema,
    compareVersionsSchema,
    versionIdSchema
} from "./schema.js";
import { CredentialLockedError, CredentialsLockedError, DisabledUserError, NoChangesDetectedError } from "./service.js";
import { hasItRole } from "../../shared/auth/rbac.js";
import { requireItRole } from "../../shared/auth/middleware.js";

export default async function credentialRoutes(app, { config, userRepo, credentialService, auditRepo }) {
    const ensureTemplateAccess = (actor, reply, detail) => {
        if (hasItRole(actor)) {
            return true;
        }

        sendProblem(reply, createProblemDetails({
            status: 403,
            title: "Forbidden",
            detail
        }));
        return false;
    };

    const logBlockedCredentialOperation = async (actorUserId, attemptedAction, targetUserId, reason = "user_disabled") => {
        if (!auditRepo) return;

        const actionMap = {
            generate: "credential.generation.blocked",
            regenerate: "credential.regeneration.blocked",
            override: "credential.override.blocked",
            override_confirm: "credential.override.blocked"
        };
        const entityTypeMap = {
            generate: "User",
            regenerate: "UserCredential",
            override: "User",
            override_confirm: "User"
        };

        await auditRepo.createAuditLog({
            action: actionMap[attemptedAction] ?? "credential.operation.blocked",
            actorUserId,
            entityType: entityTypeMap[attemptedAction] ?? "User",
            entityId: targetUserId,
            metadata: {
                attemptedOperation: attemptedAction,
                reason,
                userStatus: "disabled"
            }
        });
    };

    app.post("/", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        if (!ensureTemplateAccess(actor, reply, "Only IT roles can manage credential templates")) return;

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

        if (!ensureTemplateAccess(actor, reply, "Only IT roles can view credential templates")) return;

        const templates = await credentialService.listTemplates();
        reply.send({ data: templates });
    });

    app.get("/:id", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        if (!ensureTemplateAccess(actor, reply, "Only IT roles can view credential templates")) return;

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

        if (!ensureTemplateAccess(actor, reply, "Only IT roles can update credential templates")) return;

        const { id } = request.params;
        const validation = updateTemplateSchema.safeParse(request.body);

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
        const generationValidation = previewRequestSchema.safeParse(request.body || {});
        if (!generationValidation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: generationValidation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
            return;
        }
        const { systemId } = generationValidation.data;

        try {
            const result = await credentialService.generateUserCredentials(actor.id, userId, systemId);

            // Audit log the generation
            if (auditRepo) {
                await auditRepo.createAuditLog({
                    action: "credentials.generate",
                    actorUserId: actor.id,
                    entityType: "UserCredential",
                    entityId: userId,
                    metadata: {
                        systems: result.credentials.map(c => c.systemId),
                        templateVersion: result.templateVersion,
                        credentialCount: result.credentials.length
                    }
                });
            }

            reply.code(201).send({
                data: {
                    userId: result.userId,
                    credentials: result.credentials,
                    templateVersion: result.templateVersion,
                    metadata: result.metadata
                }
            });
        } catch (error) {
            // Handle disabled user error
            if (error instanceof DisabledUserError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/disabled-user',
                    status: 422,
                    title: "Disabled User",
                    detail: "Cannot generate credentials for disabled users",
                    userId: error.userId,
                    userStatus: "disabled",
                    suggestion: "Enable the user before generating credentials"
                }));

                // Audit log the blocked generation attempt
                await logBlockedCredentialOperation(actor.id, "generate", userId);
                return;
            }

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

        const { userId } = request.params;
        const hasPrivilegedCredentialAccess = hasItRole(actor);
        const isSelf = actor.id === userId;

        // RBAC: Allow privileged roles or self
        if (!hasPrivilegedCredentialAccess && !isSelf) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "You do not have permission to view these credentials"
            }));
            return;
        }

        const includeItOnly = hasPrivilegedCredentialAccess;

        try {
            const credentials = await credentialService.listUserCredentials(userId, includeItOnly);

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

            const hasPrivilegedCredentialAccess = hasItRole(actor);
            const isSelf = actor.id === credential.userId;

            // RBAC Check
            if (!hasPrivilegedCredentialAccess && !isSelf) {
                sendProblem(reply, createProblemDetails({
                    status: 403,
                    title: "Forbidden",
                    detail: "You do not have permission to view this credential"
                }));
                return;
            }

            // IMAP credentials require privileged roles (IT/Admin/Head IT).
            if (credential.systemConfig?.isItOnly) {
                const hasImapAccess = await requireItRole(request, reply, {
                    auditRepo,
                    targetUserId: credential.userId,
                    targetCredentialId: credential.id
                });
                if (!hasImapAccess) {
                    return;
                }
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
        const { systemId } = validation.data;

        try {
            const preview = await credentialService.previewUserCredentials(userId, systemId);

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
                    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
                    metadata: preview.metadata
                }
            });
        } catch (error) {
            if (error instanceof DisabledUserError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/disabled-user',
                    status: 422,
                    title: "Disabled User",
                    detail: "Cannot generate credentials for disabled users",
                    userId: error.userId,
                    userStatus: "disabled",
                    suggestion: "Enable the user before generating credentials"
                }));
                await logBlockedCredentialOperation(actor.id, "generate", userId);
                return;
            }

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
        const { previewToken, confirmed, skipLocked, force } = validation.data;

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

            // Verify it's a generation session (older sessions may not have type but must include generation fields).
            const isGenerationSession =
                previewSession.type === "generation" ||
                (previewSession.type === undefined && Array.isArray(previewSession.credentials));
            if (!isGenerationSession) {
                sendProblem(reply, createProblemDetails({
                    status: 400,
                    title: "Invalid Preview Token",
                    detail: "The preview token is not valid for credential generation."
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
                        systems: result.credentials.map(c => c.systemId),
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

            if (error instanceof DisabledUserError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/disabled-user',
                    status: 422,
                    title: "Disabled User",
                    detail: "Cannot generate credentials for disabled users",
                    userId: error.userId,
                    userStatus: "disabled",
                    suggestion: "Enable the user before generating credentials"
                }));
                await logBlockedCredentialOperation(actor.id, "generate", userId);
                return;
            }

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
            const preview = await credentialService.previewCredentialRegeneration(userId, validation.data.systemId);

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
                    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
                    metadata: preview.metadata
                }
            });
        } catch (error) {
            // Handle disabled user error
            if (error instanceof DisabledUserError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/disabled-user',
                    status: 422,
                    title: "Disabled User",
                    detail: "Cannot regenerate credentials for disabled users",
                    userId: error.userId,
                    userStatus: "disabled",
                    suggestion: "Enable the user before regenerating credentials"
                }));

                // Audit log the blocked attempt
                await logBlockedCredentialOperation(actor.id, "regenerate", userId);
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
                    type: '/problems/disabled-user',
                    status: 422,
                    title: "Disabled User",
                    detail: "Cannot regenerate credentials for disabled users",
                    userId: error.userId,
                    userStatus: "disabled",
                    suggestion: "Enable the user before regenerating credentials"
                }));
                await logBlockedCredentialOperation(actor.id, "regenerate", userId);
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
        const { previewToken, confirmed, skipLocked, force } = validation.data;

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
            const result = await credentialService.confirmRegeneration(actor.id, previewSession, {
                skipLocked: skipLocked === true,
                force: force === true
            });

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
                        templateVersion: result.templateVersion,
                        forced: result.forced === true
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
                    forced: result.forced === true,
                    performedBy: result.performedBy,
                    performedAt: result.performedAt
                }
            });
        } catch (error) {
            console.error('Confirm regeneration error:', error);

            // Handle disabled user error during confirmation
            if (error instanceof DisabledUserError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/disabled-user',
                    status: 422,
                    title: "Disabled User",
                    detail: "User was disabled during the regeneration process",
                    userId: error.userId,
                    userStatus: "disabled",
                    suggestion: "Enable the user before regenerating credentials"
                }));
                await logBlockedCredentialOperation(actor.id, "regenerate", userId);
                return;
            }

            if (error instanceof CredentialsLockedError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/credentials-locked',
                    status: 422,
                    title: "Credentials Cannot Be Regenerated",
                    detail: "Some credentials are locked and cannot be regenerated",
                    lockedCredentials: error.lockedCredentials,
                    suggestion: "Unlock the credentials or skip locked credentials to proceed"
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

    // Credential History Routes (Story 2.5)

    // GET /api/v1/credential-templates/users/:userId/history (also under /api/v1/credentials) - List history with filtering
    app.get("/users/:userId/history", async (request, reply) => {
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

        const { userId } = request.params;

        // Validate query parameters
        const validation = historyQuerySchema.safeParse(request.query || {});
        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Query Parameters",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
            return;
        }

        try {
            const filters = validation.data;
            const history = await credentialService.getCredentialHistory(userId, filters);

            // Audit log the access
            if (auditRepo) {
                await auditRepo.createAuditLog({
                    action: "credentials.history.list",
                    actorUserId: actor.id,
                    entityType: "UserCredential",
                    entityId: userId,
                    metadata: {
                        filters: {
                            system: filters.system,
                            startDate: filters.startDate,
                            endDate: filters.endDate
                        },
                        resultCount: history.data.length,
                        page: history.meta.page,
                        limit: history.meta.limit
                    }
                });
            }

            reply.send({
                data: history.data,
                meta: history.meta
            });
        } catch (error) {
            console.error('Get credential history error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Retrieve History",
                detail: error.message || "Failed to retrieve credential history"
            }));
        }
    });

    // GET /api/v1/credential-templates/versions/:versionId (also under /api/v1/credentials) - Get version details
    app.get("/versions/:versionId", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can view credential versions"
            }));
            return;
        }

        const { versionId } = request.params;

        // Validate version ID format (UUID)
        const validation = versionIdSchema.safeParse({ versionId });
        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Version ID",
                detail: "Version ID is required"
            }));
            return;
        }

        try {
            const version = await credentialService.getCredentialVersion(versionId);

            if (!version) {
                sendProblem(reply, createProblemDetails({
                    status: 404,
                    title: "Not Found",
                    detail: "Credential version not found"
                }));
                return;
            }

            // Audit log the access
            if (auditRepo) {
                await auditRepo.createAuditLog({
                    action: "credentials.version.view",
                    actorUserId: actor.id,
                    entityType: "CredentialVersion",
                    entityId: versionId,
                    metadata: {
                        userId: version.userId,
                        system: version.system,
                        reason: version.reason
                    }
                });
            }

            reply.send({ data: version });
        } catch (error) {
            console.error('Get credential version error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Retrieve Version",
                detail: error.message || "Failed to retrieve credential version"
            }));
        }
    });

    // POST /api/v1/credential-templates/versions/compare (also under /api/v1/credentials) - Compare two versions
    app.post("/versions/compare", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can compare credential versions"
            }));
            return;
        }

        // Validate request body
        const validation = compareVersionsSchema.safeParse(request.body || {});
        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
            return;
        }

        const { versionId1, versionId2 } = validation.data;

        try {
            const comparison = await credentialService.compareCredentialVersions(versionId1, versionId2);

            // Audit log the comparison
            if (auditRepo) {
                await auditRepo.createAuditLog({
                    action: "credentials.version.compare",
                    actorUserId: actor.id,
                    entityType: "CredentialVersion",
                    entityId: `${versionId1}_vs_${versionId2}`,
                    metadata: {
                        versionId1,
                        versionId2,
                        system: comparison.system,
                        differences: comparison.differences.map(d => d.field)
                    }
                });
            }

            reply.send({ data: comparison });
        } catch (error) {
            // Handle specific error for different systems
            if (error.code === 'DIFFERENT_SYSTEMS') {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/comparison-error',
                    status: 400,
                    title: "Comparison Not Allowed",
                    detail: "Cannot compare versions from different systems",
                    system1: error.system1,
                    system2: error.system2
                }));
                return;
            }

            // Handle version not found error
            if (error.message?.includes('not found')) {
                sendProblem(reply, createProblemDetails({
                    status: 404,
                    title: "Not Found",
                    detail: error.message
                }));
                return;
            }

            console.error('Compare credential versions error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Comparison Failed",
                detail: error.message || "Failed to compare credential versions"
            }));
        }
    });

    // POST /api/v1/credential-templates/versions/:versionId/reveal (also under /api/v1/credentials) - Reveal password
    app.post("/versions/:versionId/reveal", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can reveal passwords"
            }));
            return;
        }

        const { versionId } = request.params;

        // Validate version ID
        const validation = versionIdSchema.safeParse({ versionId });
        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Version ID",
                detail: "Version ID is required"
            }));
            return;
        }

        try {
            const version = await credentialService.revealCredentialPassword(versionId, actor.id);

            // Audit log the password reveal (sensitive action)
            if (auditRepo) {
                await auditRepo.createAuditLog({
                    action: "credentials.password.reveal",
                    actorUserId: actor.id,
                    entityType: "CredentialVersion",
                    entityId: versionId,
                    metadata: {
                        userId: version.userId,
                        system: version.system,
                        reason: version.reason,
                        timestamp: version.timestamp
                    }
                });
            }

            reply.send({ data: version });
        } catch (error) {
            // Handle version not found error
            if (error.code === 'VERSION_NOT_FOUND') {
                sendProblem(reply, createProblemDetails({
                    status: 404,
                    title: "Not Found",
                    detail: "Credential version not found",
                    versionId: error.versionId
                }));
                return;
            }

            console.error('Reveal password error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Reveal Password",
                detail: error.message || "Failed to reveal password"
            }));
        }
    });

    // Credential Override Routes (Story 2.6)

    // POST /api/v1/users/:userId/credentials/:system/override/preview - Preview credential override
    app.post("/users/:userId/:system/override/preview", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can override credentials"
            }));
            return;
        }

        // Validate request body with Zod
        const validation = overridePreviewSchema.safeParse(request.body || {});
        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
            return;
        }

        const { userId, system } = request.params;
        const overrideData = validation.data;

        try {
            // Generate override preview
            const preview = await credentialService.previewCredentialOverride(userId, system, overrideData);

            // Audit log the override preview
            if (auditRepo) {
                await auditRepo.createAuditLog({
                    action: "credentials.override.preview",
                    actorUserId: actor.id,
                    entityType: "UserCredential",
                    entityId: userId,
                    metadata: {
                        system: system,
                        changes: preview.changes,
                        reason: overrideData.reason
                    }
                });
            }

            reply.send({
                data: {
                    previewToken: preview.previewToken,
                    expiresAt: preview.expiresAt,
                    currentCredential: preview.currentCredential,
                    proposedCredential: preview.proposedCredential,
                    changes: preview.changes,
                    reason: overrideData.reason
                }
            });
        } catch (error) {
            // Handle disabled user error
            if (error instanceof DisabledUserError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/disabled-user',
                    status: 422,
                    title: "Disabled User",
                    detail: "Cannot override credentials for disabled users",
                    userId: error.userId,
                    userStatus: "disabled",
                    suggestion: "Re-enable the user first"
                }));
                await logBlockedCredentialOperation(actor.id, "override", userId);
                return;
            }

            if (error instanceof CredentialLockedError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/credential-locked',
                    status: 409,
                    title: "Credential Locked",
                    detail: "This credential is locked and must be unlocked before override.",
                    userId: error.userId,
                    system: error.systemId,
                    lockDetails: error.lockDetails,
                    suggestion: "Unlock the credential first, then retry override."
                }));
                return;
            }

            // Handle user not found error
            if (error.code === 'USER_NOT_FOUND') {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/user-not-found',
                    status: 404,
                    title: "User Not Found",
                    detail: "User not found",
                    userId: error.userId
                }));
                return;
            }

            // Handle no active credential error
            if (error.code === 'NO_ACTIVE_CREDENTIAL') {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/no-active-credential',
                    status: 404,
                    title: "No Active Credential",
                    detail: "No active credential found for this system",
                    userId: error.userId,
                    system: error.system
                }));
                return;
            }

            console.error('Override preview error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Override Preview Failed",
                detail: error.message || "Failed to preview credential override"
            }));
        }
    });

    // POST /api/v1/users/:userId/credentials/:system/override/confirm - Confirm and execute override
    app.post("/users/:userId/:system/override/confirm", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can confirm credential overrides"
            }));
            return;
        }

        // Validate request body with Zod
        const validation = confirmOverrideSchema.safeParse(request.body || {});
        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
            return;
        }

        const { userId, system } = request.params;
        const { previewToken, confirmed } = validation.data;

        // Validate explicit confirmation
        if (!confirmed) {
            sendProblem(reply, createProblemDetails({
                type: '/problems/confirmation-required',
                status: 400,
                title: "Explicit Confirmation Required",
                detail: "You must explicitly confirm the credential override before proceeding."
            }));
            return;
        }

        try {
            // Retrieve and validate preview session
            const previewSession = await credentialService.getPreviewSession(previewToken);

            if (!previewSession) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/invalid-preview-token',
                    status: 400,
                    title: "Invalid Preview Token",
                    detail: "Preview session expired or invalid",
                    suggestion: "Generate a new preview before confirming"
                }));
                return;
            }

            // Verify it's an override session
            if (previewSession.type !== 'override') {
                sendProblem(reply, createProblemDetails({
                    status: 400,
                    title: "Invalid Preview Token",
                    detail: "The preview token is not valid for override."
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

            // Verify system matches the preview
            if (previewSession.system !== system) {
                sendProblem(reply, createProblemDetails({
                    status: 400,
                    title: "Invalid Preview Token",
                    detail: "The preview token does not match the specified system."
                }));
                return;
            }

            // Execute the override
            const result = await credentialService.confirmCredentialOverride(actor.id, {
                ...previewSession,
                token: previewToken
            });

            reply.code(201).send({
                data: {
                    credentialId: result.credentialId,
                    system: result.system,
                    overriddenAt: result.overriddenAt,
                    overriddenBy: result.overriddenBy,
                    historyVersionId: result.historyVersionId,
                    changes: result.changes
                }
            });
        } catch (error) {
            // Handle disabled user error during confirmation
            if (error instanceof DisabledUserError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/disabled-user',
                    status: 422,
                    title: "Disabled User",
                    detail: "User was disabled during the override process",
                    userId: error.userId,
                    userStatus: "disabled",
                    suggestion: "Re-enable the user first"
                }));
                await logBlockedCredentialOperation(actor.id, "override_confirm", userId);
                return;
            }

            if (error instanceof CredentialLockedError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/credential-locked',
                    status: 409,
                    title: "Credential Locked",
                    detail: "This credential is locked and must be unlocked before override.",
                    userId: error.userId,
                    system: error.systemId,
                    lockDetails: error.lockDetails,
                    suggestion: "Unlock the credential first, then retry override."
                }));
                return;
            }

            // Handle user not found error
            if (error.code === 'USER_NOT_FOUND') {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/user-not-found',
                    status: 404,
                    title: "User Not Found",
                    detail: "User not found",
                    userId: error.userId
                }));
                return;
            }

            if (error.code === 'NO_ACTIVE_CREDENTIAL') {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/no-active-credential',
                    status: 404,
                    title: "No Active Credential",
                    detail: "No active credential found for this system",
                    userId: error.userId,
                    system: error.system
                }));
                return;
            }

            if (error.code === 'CREDENTIAL_CHANGED_SINCE_PREVIEW') {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/preview-conflict',
                    status: 409,
                    title: "Preview Conflict",
                    detail: "Credential changed since preview. Generate a new preview and confirm again.",
                    userId: error.userId,
                    system: error.system
                }));
                return;
            }

            console.error('Confirm override error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Override Credential",
                detail: error.message || "Failed to complete credential override"
            }));
        }
    });

    // Lock/Unlock Routes (Story 2.9)
    // Mounted at /api/v1/credentials (or credential-templates)

    // GET /api/v1/credentials/locked - List all locked credentials
    app.get("/locked", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        if (!hasItRole(actor)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                type: "/problems/insufficient-permissions",
                detail: "Only IT roles can view locked credentials"
            }));
            return;
        }

        try {
            const page = parseInt(request.query.page) || 1;
            const limit = parseInt(request.query.limit) || 20;
            const { systemId, userId, startDate, endDate } = request.query || {};

            const result = await credentialService.getLockedCredentials({
                page,
                limit,
                systemId,
                userId,
                startDate,
                endDate
            });
            reply.send({
                data: result.data,
                meta: result.meta
            });
        } catch (error) {
            console.error('List locked credentials error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to List Locked Credentials",
                detail: error.message
            }));
        }
    });

    // POST /api/v1/credentials/:userId/:systemId/lock - Lock credential
    app.post("/:userId/:systemId/lock", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        if (!hasItRole(actor)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                type: "/problems/insufficient-permissions",
                detail: "Only IT roles can lock credentials"
            }));
            return;
        }

        const { userId, systemId } = request.params;
        const validation = lockCredentialSchema.safeParse(request.body || {});

        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
            return;
        }

        try {
            const result = await credentialService.lockCredential(userId, systemId, validation.data.reason, actor.id);
            reply.send({ data: result });
        } catch (error) {
            if (error.code === 'CREDENTIAL_NOT_FOUND') {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/credential-not-found',
                    status: 404,
                    title: "Credential Not Found",
                    detail: error.message,
                    userId: error.userId,
                    systemId: error.systemId
                }));
                return;
            }
            if (error.code === 'CREDENTIAL_ALREADY_LOCKED') {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/credential-already-locked',
                    status: 409,
                    title: "Credential Already Locked",
                    detail: error.message,
                    userId: error.userId,
                    systemId: error.systemId,
                    suggestion: "Unlock the credential before attempting to lock again."
                }));
                return;
            }
            console.error('Lock credential error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Lock Failed",
                detail: error.message
            }));
        }
    });

    // POST /api/v1/credentials/:userId/:systemId/unlock - Unlock credential
    app.post("/:userId/:systemId/unlock", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        if (!hasItRole(actor)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                type: "/problems/insufficient-permissions",
                detail: "Only IT roles can unlock credentials"
            }));
            return;
        }

        const { userId, systemId } = request.params;

        try {
            const result = await credentialService.unlockCredential(userId, systemId, actor.id);
            reply.send({ data: result });
        } catch (error) {
            if (error.code === 'CREDENTIAL_NOT_LOCKED') {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/credential-not-locked',
                    status: 409,
                    title: "Credential Not Locked",
                    detail: error.message,
                    userId: error.userId,
                    systemId: error.systemId,
                    suggestion: "The credential is already unlocked."
                }));
                return;
            }
            console.error('Unlock credential error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Unlock Failed",
                detail: error.message
            }));
        }
    });

    // GET /api/v1/credentials/:userId/:systemId/lock-status - Check status
    app.get("/:userId/:systemId/lock-status", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // Allowed for IT and maybe owner? Requirement says IT.
        if (!hasItRole(actor)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                type: "/problems/insufficient-permissions",
                detail: "Only IT roles can view lock status"
            }));
            return;
        }

        const { userId, systemId } = request.params;
        try {
            const status = await credentialService.getLockStatus(userId, systemId);
            reply.send({ data: status });
        } catch (error) {
            console.error('Get lock status error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Get Status",
                detail: error.message
            }));
        }
    });

    // GET /api/v1/credentials/users/:userId/locked - List locked for user
    app.get("/users/:userId/locked", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        if (!hasItRole(actor)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                type: "/problems/insufficient-permissions",
                detail: "Only IT roles can view locked credentials"
            }));
            return;
        }

        const { userId } = request.params;
        try {
            const page = parseInt(request.query.page) || 1;
            const limit = parseInt(request.query.limit) || 20;
            const { systemId, startDate, endDate } = request.query || {};

            const result = await credentialService.getLockedCredentials({
                userId,
                page,
                limit,
                systemId,
                startDate,
                endDate
            });
            reply.send({
                data: result.data,
                meta: result.meta
            });
        } catch (error) {
            console.error('List user locked credentials error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to List Locked Credentials",
                detail: error.message
            }));
        }
    });

}
