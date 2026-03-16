import { requireAuthenticated } from "../../shared/auth/requireAuthenticated.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";

export default async function maintenanceRoutes(app, { config, userRepo, maintenanceService }) {

    const maintenanceConfigMeta = {
        contract: 'maintenance-cycle-config.v1',
        requiredFields: maintenanceService.MAINTENANCE_CONFIG_REQUIRED_FIELDS ?? []
    };

    // Helper to standardize error response
    const handleError = (reply, error) => {
        if (error.name === 'ZodError') {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                type: '/problems/validation-error',
                detail: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', '),
                metadata: {
                    source: 'maintenance'
                }
            }));
            return;
        }

        const status = error.statusCode || 500;
        const defaultTitleByStatus = {
            400: "Bad Request",
            401: "Unauthorized",
            403: "Forbidden",
            404: "Not Found",
            409: "Conflict",
            500: "Internal Server Error"
        };
        const defaultTypeByStatus = {
            400: '/problems/maintenance/bad-request',
            401: '/problems/maintenance/unauthorized',
            403: '/problems/maintenance/forbidden',
            404: '/problems/maintenance/not-found',
            409: '/problems/maintenance/conflict',
            500: '/problems/maintenance/internal-error'
        };

        const extensionKeys = [
            'validation',
            'incompleteRequiredItems',
            'unknownChecklistItemIds',
            'department',
            'metadata'
        ];
        const extensions = {};
        for (const key of extensionKeys) {
            if (error[key] !== undefined) {
                extensions[key] = error[key];
            }
        }

        console.error('Maintenance API Error:', error);
        sendProblem(reply, createProblemDetails({
            status,
            title: defaultTitleByStatus[status] || "Internal Server Error",
            type: error.type || defaultTypeByStatus[status] || '/problems/maintenance/internal-error',
            detail: error.message || 'Unexpected maintenance error.',
            ...extensions
        }));
    };

    // Cycle Config Routes

    app.post('/cycles', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const cycle = await maintenanceService.createMaintenanceCycle(request.body, actor);
            reply.code(201).send({ data: cycle });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.get('/cycles', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const includeInactive = request.query.includeInactive === 'true';
            const cycles = await maintenanceService.getMaintenanceCycles(includeInactive);
            reply.send({
                data: cycles,
                meta: maintenanceConfigMeta
            });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.get('/cycles/:id', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const cycle = await maintenanceService.getMaintenanceCycleById(request.params.id);
            if (!cycle) {
                return sendProblem(reply, createProblemDetails({
                    status: 404,
                    title: "Not Found",
                    type: '/problems/maintenance/cycle-not-found',
                    detail: "Maintenance cycle not found"
                }));
            }
            reply.send({
                data: cycle,
                meta: maintenanceConfigMeta
            });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.patch('/cycles/:id', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const cycle = await maintenanceService.updateMaintenanceCycle(request.params.id, request.body, actor);
            reply.send({ data: cycle });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.delete('/cycles/:id', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const cycle = await maintenanceService.deactivateMaintenanceCycle(request.params.id, actor);
            reply.send({ data: cycle });
        } catch (error) {
            handleError(reply, error);
        }
    });

    // Window Routes

    app.post('/windows', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const window = await maintenanceService.createMaintenanceWindow(request.body, actor);
            reply.code(201).send({ data: window });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.get('/windows', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const result = await maintenanceService.getMaintenanceWindows(request.query, actor);
            reply.send(result);
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.get('/windows/:id', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const window = await maintenanceService.getMaintenanceWindowById(request.params.id);
            if (!window) {
                return sendProblem(reply, createProblemDetails({
                    status: 404,
                    title: "Not Found",
                    detail: "Maintenance window not found"
                }));
            }
            reply.send({ data: window });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.patch('/windows/:id', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const window = await maintenanceService.updateMaintenanceWindow(request.params.id, request.body, actor);
            reply.send({ data: window });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.post('/windows/:id/cancel', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const { reason } = request.body || {};
            const window = await maintenanceService.cancelMaintenanceWindow(request.params.id, reason, actor);
            reply.send({ data: window });
        } catch (error) {
            handleError(reply, error);
        }
    });

    // Schedule Generation
    app.post('/cycles/:id/generate-schedule', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const result = await maintenanceService.generateScheduleForCycle(request.params.id, actor, request.body || {});
            reply.send({ data: result });
        } catch (error) {
            handleError(reply, error);
        }
    });

    // Checklist Template Routes

    app.post('/checklists', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const template = await maintenanceService.createChecklistTemplate(request.body, actor);
            reply.code(201).send({ data: template });
        } catch (error) {
            if (error.statusCode === 409) {
                return sendProblem(reply, createProblemDetails({
                    status: 409,
                    title: "Conflict",
                    detail: error.message
                }));
            }
            handleError(reply, error);
        }
    });

    app.get('/checklists', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const includeInactive = request.query.includeInactive === 'true';
            const templates = await maintenanceService.getChecklistTemplates(includeInactive);
            reply.send({ data: templates });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.get('/checklists/:id', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const template = await maintenanceService.getChecklistTemplateById(request.params.id);
            if (!template) {
                return sendProblem(reply, createProblemDetails({
                    status: 404,
                    title: "Not Found",
                    detail: "Checklist template not found"
                }));
            }
            reply.send({ data: template });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.patch('/checklists/:id', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const template = await maintenanceService.updateChecklistTemplate(request.params.id, request.body, actor);
            reply.send({ data: template });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.delete('/checklists/:id', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const template = await maintenanceService.deactivateChecklistTemplate(request.params.id, actor);
            reply.send({ data: template });
        } catch (error) {
            handleError(reply, error);
        }
    });

    // Department Assignment Rule Routes

    app.post('/assignment-rules', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const rule = await maintenanceService.createDepartmentAssignmentRule(request.body, actor);
            reply.code(201).send({ data: rule });
        } catch (error) {
            if (error.statusCode === 409) {
                return sendProblem(reply, createProblemDetails({
                    status: 409,
                    title: "Conflict",
                    type: error.type || '/problems/duplicate-department',
                    detail: error.message,
                    department: error.department
                }));
            }
            if (error.statusCode === 400 && error.validation) {
                return sendProblem(reply, createProblemDetails({
                    status: 400,
                    title: "Invalid Assignment Rule",
                    type: error.type || '/problems/invalid-assignment-rule',
                    detail: error.message,
                    validation: error.validation
                }));
            }
            handleError(reply, error);
        }
    });

    app.get('/assignment-rules', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const includeInactive = request.query.includeInactive === 'true';
            const rules = await maintenanceService.getDepartmentAssignmentRules(includeInactive);
            reply.send({ data: rules });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.get('/assignment-rules/:id', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const rule = await maintenanceService.getDepartmentAssignmentRuleById(request.params.id);
            reply.send({ data: rule });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.patch('/assignment-rules/:id', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const rule = await maintenanceService.updateDepartmentAssignmentRule(request.params.id, request.body, actor);
            reply.send({ data: rule });
        } catch (error) {
            if (error.statusCode === 400 && error.validation) {
                return sendProblem(reply, createProblemDetails({
                    status: 400,
                    title: "Invalid Assignment Rule",
                    type: error.type || '/problems/invalid-assignment-rule',
                    detail: error.message,
                    validation: error.validation
                }));
            }
            handleError(reply, error);
        }
    });

    app.delete('/assignment-rules/:id', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const rule = await maintenanceService.deactivateDepartmentAssignmentRule(request.params.id, actor);
            reply.send({ data: rule });
        } catch (error) {
            handleError(reply, error);
        }
    });

    // Manual Assignment
    app.post('/windows/:id/assign', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const { userId } = request.body;
            const window = await maintenanceService.manuallyAssignMaintenanceWindow(request.params.id, userId, actor);
            reply.send({ data: window });
        } catch (error) {
            handleError(reply, error);
        }
    });

    // Rotation Management
    app.post('/assignment-rules/:id/reset-rotation', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const rotationState = await maintenanceService.resetDepartmentRotation(request.params.id, actor);
            reply.send({
                data: rotationState,
                meta: { message: 'Rotation reset to first technician' }
            });
        } catch (error) {
            handleError(reply, error);
        }
    });

    // My Assigned Windows
    app.get('/my-tasks', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;


        try {
            const result = await maintenanceService.getMyMaintenanceWindows(actor.id, request.query);
            reply.send(result);
        } catch (error) {
            handleError(reply, error);
        }
    });

    // Maintenance Completion Routes

    app.post('/windows/:id/sign-off', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const completion = await maintenanceService.signOffMaintenanceWindow(
                request.params.id,
                actor.id,
                request.body,
                actor
            );
            reply.send({ data: completion });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.get('/windows/:id/completion', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const completion = await maintenanceService.getMaintenanceCompletion(request.params.id, actor);
            reply.send({ data: completion });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.get('/windows/:id/sign-off-eligibility', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const eligibility = await maintenanceService.getSignOffEligibility(request.params.id, actor);
            reply.send({ data: eligibility });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.get('/completions/my-history', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const result = await maintenanceService.getMyCompletionHistory(request.query || {}, actor);
            reply.send(result);
        } catch (error) {
            handleError(reply, error);
        }
    });

    // Legacy alias kept for compatibility with existing clients.
    app.get('/history', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            // Allows admins to view others history via query param? 
            // Story says "My history". Service supports viewing others if admin.
            // Let's stick to "My history" for this endpoint, or support userId param?
            // "GET /api/v1/maintenance/history" -> My history.

            const userId = request.query.userId || actor.id;

            const result = await maintenanceService.getCompletionHistory(userId, request.query || {}, actor);
            reply.send(result);
        } catch (error) {
            handleError(reply, error);
        }
    });
}
