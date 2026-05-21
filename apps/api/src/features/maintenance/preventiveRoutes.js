import { requireAuthenticated } from '../../shared/auth/requireAuthenticated.js';
import { requireItUser } from '../../shared/auth/requireItUser.js';
import * as preventiveService from './preventiveMaintenanceService.js';
import * as taskPresetService from './taskPresetService.js';

export default async function preventiveMaintenanceRoutes(app, { config, userRepo }) {
    const handleError = (reply, error) => {
        const status = error.name === 'ZodError' ? 400 : error.statusCode || 500;
        reply.code(status).send({
            type: '/problems/maintenance/preventive-error',
            title: status === 404 ? 'Not Found' : 'Maintenance Error',
            status,
            detail: error.message
        });
    };

    app.get('/task-presets', async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            reply.send({ data: await taskPresetService.listTaskPresets(request.query) });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.post('/task-presets', async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            const preset = await taskPresetService.createTaskPreset(request.body, actor);
            reply.code(201).send({ data: preset });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.delete('/task-presets/:id', async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            reply.send({ data: await taskPresetService.deactivateTaskPreset(request.params.id) });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.get('/profiles', async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            const includeInactive = request.query.includeInactive === 'true';
            reply.send({ data: await preventiveService.listMaintenanceProfiles(includeInactive) });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.post('/profiles', async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            const profile = await preventiveService.createMaintenanceProfile(request.body, actor);
            reply.code(201).send({ data: profile });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.patch('/profiles/:id', async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            const profile = await preventiveService.updateMaintenanceProfile(request.params.id, request.body, actor);
            reply.send({ data: profile });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.put('/profiles/:id/checklist', async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            const template = await preventiveService.saveProfileChecklist(request.params.id, request.body, actor);
            reply.send({ data: template });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.get('/assignments/matrix', async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            reply.send({ data: await preventiveService.listAssetsAssignmentMatrix() });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.get('/assignments', async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            reply.send({ data: await preventiveService.listMaintenanceAssignments() });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.post('/assignments', async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            const assignment = await preventiveService.createMaintenanceAssignment(request.body, actor);
            reply.code(201).send({ data: assignment });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.get('/runs/my', async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            reply.send(await preventiveService.listTechnicianRuns(actor, request.query));
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.get('/runs/history', async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            reply.send(await preventiveService.listMaintenanceRunHistory(actor, request.query));
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.get('/runs/:id', async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            reply.send({ data: await preventiveService.getMaintenanceRun(request.params.id, actor) });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.post('/runs/:id/start', async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            reply.send({ data: await preventiveService.startRun(request.params.id, actor) });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.patch('/runs/items/:itemId', async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            reply.send({ data: await preventiveService.updateRunItem(request.params.itemId, request.body, actor) });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.post('/runs/items/:itemId/evidence', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            const data = await request.file();
            if (!data || data.fieldname !== 'evidence') {
                const error = new Error('No evidence file uploaded');
                error.statusCode = 400;
                throw error;
            }

            const chunks = [];
            for await (const chunk of data.file) {
                chunks.push(chunk);
            }
            if (data.file.truncated) {
                const error = new Error('File too large. Maximum size: 5MB');
                error.statusCode = 413;
                throw error;
            }

            const buffer = Buffer.concat(chunks);
            const file = {
                filename: data.filename,
                mimetype: data.mimetype,
                size: buffer.length,
                buffer
            };

            reply.send({
                data: await preventiveService.uploadRunItemEvidence(request.params.itemId, file, actor)
            });
        } catch (error) {
            handleError(reply, error);
        }
    });

    app.post('/runs/:id/complete', async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;
        try {
            reply.send({ data: await preventiveService.completeRun(request.params.id, actor) });
        } catch (error) {
            handleError(reply, error);
        }
    });
}
