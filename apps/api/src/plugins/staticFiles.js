import path from 'path';
import fs from 'node:fs/promises';
import { uploadsConfig } from '../config/uploads.js';
import { requireAuthenticated } from '../shared/auth/requireAuthenticated.js';
import { createProblemDetails, sendProblem } from '../shared/errors/problemDetails.js';
import { hasItRole, hasAdminRole } from '../shared/auth/rbac.js';

export default async function staticFilesPlugin(app, options) {
    const {
        config,
        userRepo,
        requestRepo,
        maintenanceRepo
    } = options ?? {};

    const uploadPath = path.isAbsolute(uploadsConfig.uploadDir)
        ? uploadsConfig.uploadDir
        : path.resolve(process.cwd(), uploadsConfig.uploadDir);

    app.get('/api/v1/uploads/*', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        const filename = request.params['*'];
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return sendProblem(reply, createProblemDetails({
                status: 400,
                title: 'Bad Request',
                detail: 'Invalid filename'
            }));
        }

        const fileUrl = `/api/v1/uploads/${filename}`;
        const linkedRequest = await requestRepo?.getRequestByInvoiceFileUrl?.(fileUrl);
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
            const linkedEvidence = await maintenanceRepo?.getRunItemByEvidenceUrl?.(fileUrl);
            if (linkedEvidence) {
                const canAccess = linkedEvidence.run.userId === actor.id || hasItRole(actor) || hasAdminRole(actor);
                if (!canAccess) {
                    return sendProblem(reply, createProblemDetails({
                        status: 403,
                        title: 'Forbidden',
                        detail: 'You do not have permission to access this evidence file'
                    }));
                }
            } else {
                const linkedCompletion = await maintenanceRepo?.getCompletionBySignerSignatureUrl?.(fileUrl);
                if (!linkedCompletion) {
                    return sendProblem(reply, createProblemDetails({
                        status: 404,
                        title: 'Not Found',
                        detail: 'File not found'
                    }));
                }
            }
        }

        const contentTypes = {
            '.pdf': 'application/pdf',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp'
        };
        try {
            const buffer = await fs.readFile(path.join(uploadPath, filename));
            reply.header('Cache-Control', 'private, no-store, max-age=0');
            reply.header('X-Content-Type-Options', 'nosniff');
            reply.type(contentTypes[path.extname(filename).toLowerCase()] || 'application/octet-stream');
            return reply.send(buffer);
        } catch {
            return sendProblem(reply, createProblemDetails({
                status: 404,
                title: 'Not Found',
                detail: 'File not found'
            }));
        }
    });
}
