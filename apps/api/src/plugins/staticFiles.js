import fastifyStatic from '@fastify/static';
import path from 'path';
import { uploadsConfig } from '../config/uploads.js';
import { requireAuthenticated } from '../shared/auth/requireAuthenticated.js';
import { createProblemDetails, sendProblem } from '../shared/errors/problemDetails.js';
import { hasItRole, hasAdminRole } from '../shared/auth/rbac.js';

/**
 * Static file serving plugin for uploaded files
 * Serves files from the uploads directory with authentication
 */
export default async function staticFilesPlugin(app, options) {
    const {
        config,
        userRepo,
        requestRepo,
        maintenanceRepo
    } = options ?? {};

    // Resolve upload directory to absolute path
    const uploadPath = path.isAbsolute(uploadsConfig.uploadDir)
        ? uploadsConfig.uploadDir
        : path.resolve(process.cwd(), uploadsConfig.uploadDir);

    // Register static file serving
    app.register(fastifyStatic, {
        root: uploadPath,
        prefix: '/api/v1/uploads/',
        serve: false // We'll serve files manually with authentication
    });

    // Manual route with authentication for file serving
    app.get('/api/v1/uploads/:filename', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        const { filename } = request.params;

        // Validate filename to prevent path traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return sendProblem(reply, createProblemDetails({
                status: 400,
                title: 'Bad Request',
                detail: 'Invalid filename'
            }));
        }

        const invoiceUrl = `/api/v1/uploads/${filename}`;
        const linkedRequest = await requestRepo?.getRequestByInvoiceFileUrl?.(invoiceUrl);

        if (linkedRequest) {
            const canAccess = linkedRequest.requesterId === actor.id || hasItRole(actor) || hasAdminRole(actor);
            if (!canAccess) {
                return sendProblem(reply, createProblemDetails({
                    status: 403,
                    title: 'Forbidden',
                    detail: 'You do not have permission to access this invoice file'
                }));
            }
        } else {
            const linkedCompletion = await maintenanceRepo?.getCompletionBySignerSignatureUrl?.(invoiceUrl);
            if (!linkedCompletion) {
                return sendProblem(reply, createProblemDetails({
                    status: 404,
                    title: 'Not Found',
                    detail: 'File not found'
                }));
            }
        }

        try {
            reply.header('Cache-Control', 'private, no-store, max-age=0');
            reply.header('X-Content-Type-Options', 'nosniff');
            return reply.sendFile(filename);
        } catch (err) {
            return sendProblem(reply, createProblemDetails({
                status: 404,
                title: 'Not Found',
                detail: 'File not found'
            }));
        }
    });
}
