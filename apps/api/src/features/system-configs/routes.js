import { z } from "zod";
import { requireAuthenticated } from "../../shared/auth/requireAuthenticated.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";
import { createSystemConfigSchema, updateSystemConfigSchema, systemIdParamSchema } from "./schema.js";
import { 
    LdapFieldNotFoundError, 
    SystemInUseError, 
    DuplicateSystemError 
} from "./service.js";

export default async function systemConfigRoutes(app, { config, userRepo, systemConfigService, auditRepo }) {

    // GET /api/v1/system-configs - List all system configurations
    app.get("/", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can view system configurations"
            }));
            return;
        }

        try {
            const configs = await systemConfigService.getSystemConfigs();

            reply.send({ 
                data: configs,
                meta: { count: configs.length }
            });
        } catch (error) {
            console.error('List system configs error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to List System Configurations",
                detail: error.message || "Failed to retrieve system configurations"
            }));
        }
    });

    // GET /api/v1/system-configs/:systemId - Get single configuration
    app.get("/:systemId", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can view system configurations"
            }));
            return;
        }

        const { systemId } = request.params;

        try {
            const config = await systemConfigService.getSystemConfig(systemId);

            if (!config) {
                sendProblem(reply, createProblemDetails({
                    status: 404,
                    title: "Not Found",
                    detail: `System configuration '${systemId}' not found`
                }));
                return;
            }

            reply.send({ data: config });
        } catch (error) {
            console.error('Get system config error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Retrieve System Configuration",
                detail: error.message || "Failed to retrieve system configuration"
            }));
        }
    });

    // POST /api/v1/system-configs - Create new system configuration
    app.post("/", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can create system configurations"
            }));
            return;
        }

        // Validate request body with Zod
        const validation = createSystemConfigSchema.safeParse(request.body);
        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
            return;
        }

        try {
            const config = await systemConfigService.createSystemConfig(validation.data, actor.id);

            reply.code(201).send({ data: config });
        } catch (error) {
            // Handle duplicate system error
            if (error instanceof DuplicateSystemError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/duplicate-system',
                    status: 409,
                    title: "System Already Exists",
                    detail: error.message,
                    systemId: error.systemId
                }));
                return;
            }

            // Handle LDAP field not found error
            if (error instanceof LdapFieldNotFoundError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/ldap-field-not-found',
                    status: 400,
                    title: "LDAP Field Not Found",
                    detail: error.message,
                    field: error.fieldName,
                    availableFields: error.availableFields
                }));
                return;
            }

            // Handle invalid system ID format
            if (error.code === 'INVALID_SYSTEM_ID_FORMAT') {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/invalid-system-id',
                    status: 400,
                    title: "Invalid System ID Format",
                    detail: error.message,
                    suggestion: "Use kebab-case format (e.g., 'corporate-vpn', 'email-system')"
                }));
                return;
            }

            console.error('Create system config error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Create System Configuration",
                detail: error.message || "Failed to create system configuration"
            }));
        }
    });

    // PUT /api/v1/system-configs/:systemId - Update system configuration
    app.put("/:systemId", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can update system configurations"
            }));
            return;
        }

        const { systemId } = request.params;

        // Validate request body with Zod
        const validation = updateSystemConfigSchema.safeParse(request.body);
        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
            return;
        }

        try {
            const config = await systemConfigService.updateSystemConfig(systemId, validation.data, actor.id);

            reply.send({ data: config });
        } catch (error) {
            // Handle system not found error
            if (error.code === 'SYSTEM_NOT_FOUND') {
                sendProblem(reply, createProblemDetails({
                    status: 404,
                    title: "Not Found",
                    detail: error.message,
                    systemId: error.systemId
                }));
                return;
            }

            // Handle LDAP field not found error
            if (error instanceof LdapFieldNotFoundError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/ldap-field-not-found',
                    status: 400,
                    title: "LDAP Field Not Found",
                    detail: error.message,
                    field: error.fieldName,
                    availableFields: error.availableFields
                }));
                return;
            }

            console.error('Update system config error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Update System Configuration",
                detail: error.message || "Failed to update system configuration"
            }));
        }
    });

    // DELETE /api/v1/system-configs/:systemId - Delete system configuration
    app.delete("/:systemId", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can delete system configurations"
            }));
            return;
        }

        const { systemId } = request.params;

        try {
            const result = await systemConfigService.deleteSystemConfig(systemId, actor.id);

            reply.send({ data: result });
        } catch (error) {
            // Handle system not found error
            if (error.code === 'SYSTEM_NOT_FOUND') {
                sendProblem(reply, createProblemDetails({
                    status: 404,
                    title: "Not Found",
                    detail: error.message,
                    systemId: error.systemId
                }));
                return;
            }

            // Handle system in use error
            if (error instanceof SystemInUseError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/system-in-use',
                    status: 409,
                    title: "System Cannot Be Deleted",
                    detail: error.message,
                    systemId: error.systemId,
                    credentialCount: error.credentialCount,
                    suggestion: "Remove all credentials for this system before deleting"
                }));
                return;
            }

            console.error('Delete system config error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Delete System Configuration",
                detail: error.message || "Failed to delete system configuration"
            }));
        }
    });

    // GET /api/v1/system-configs/ldap-fields/available - Get available LDAP fields
    app.get("/ldap-fields/available", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can view LDAP field options"
            }));
            return;
        }

        try {
            const fields = await systemConfigService.getAvailableLdapFields();

            reply.send({ 
                data: fields,
                meta: { count: fields.length }
            });
        } catch (error) {
            console.error('Get LDAP fields error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Retrieve LDAP Fields",
                detail: error.message || "Failed to retrieve available LDAP fields"
            }));
        }
    });
}
