/* eslint-disable */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path, { dirname, join } from 'node:path';
import fs from 'node:fs/promises';

const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const Fastify = require('fastify');

import appPlugin from '../../apps/api/src/server.js';
import { getAuthConfig } from '../../apps/api/src/config/authConfig.js';
import { signSessionToken } from '../../apps/api/src/shared/auth/jwt.js';
import { prisma } from '../../apps/api/src/shared/db/prisma.js';

const SIGNATURE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P8z8DwHwAE/wJ/lYI0WQAAAABJRU5ErkJggg==';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_UPLOAD_DIR = join(__dirname, '../../apps/api/test-uploads-pm-signatures');

async function build() {
    const app = Fastify();
    await app.register(appPlugin);
    return app;
}

test('Maintenance signature uploads are accessible to authenticated users', async (t) => {
    const previousUploadDir = process.env.UPLOAD_DIR;
    process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;

    const config = getAuthConfig();
    const app = await build();
    const { uploadsConfig } = await import('../../apps/api/src/config/uploads.js');
    const activeUploadDir = path.isAbsolute(uploadsConfig.uploadDir)
        ? uploadsConfig.uploadDir
        : path.join(process.cwd(), uploadsConfig.uploadDir);

    let itUser;
    let assigneeUser;
    let otherRequester;
    let itToken;
    let assigneeToken;
    let otherToken;

    let cycleId;
    let templateId;
    let checklistItemId;
    let windowId;
    let signatureUrl;

    await t.test('setup users and auth tokens', async () => {
        itUser = await prisma.user.create({
            data: {
                username: `pm-sign-it-${randomUUID()}`,
                role: 'it',
                status: 'active'
            }
        });

        assigneeUser = await prisma.user.create({
            data: {
                username: `pm-sign-assignee-${randomUUID()}`,
                role: 'requester',
                status: 'active'
            }
        });

        otherRequester = await prisma.user.create({
            data: {
                username: `pm-sign-other-${randomUUID()}`,
                role: 'requester',
                status: 'active'
            }
        });

        itToken = await signSessionToken({
            subject: itUser.id,
            payload: { username: itUser.username, role: itUser.role, status: itUser.status }
        }, config.jwt);

        assigneeToken = await signSessionToken({
            subject: assigneeUser.id,
            payload: { username: assigneeUser.username, role: assigneeUser.role, status: assigneeUser.status }
        }, config.jwt);

        otherToken = await signSessionToken({
            subject: otherRequester.id,
            payload: { username: otherRequester.username, role: otherRequester.role, status: otherRequester.status }
        }, config.jwt);
    });

    await t.test('create assisted sign-off with signature image', async () => {
        const cycleRes = await app.inject({
            method: 'POST',
            url: '/api/v1/maintenance/cycles',
            headers: { cookie: `${config.cookie.name}=${itToken}` },
            payload: {
                name: `PM Signature Cycle ${randomUUID()}`,
                intervalMonths: 3
            }
        });
        assert.equal(cycleRes.statusCode, 201, cycleRes.body);
        cycleId = JSON.parse(cycleRes.body).data.id;

        const templateRes = await app.inject({
            method: 'POST',
            url: '/api/v1/maintenance/checklists',
            headers: { cookie: `${config.cookie.name}=${itToken}` },
            payload: {
                name: `PM Signature Template ${randomUUID()}`,
                items: [{ title: 'Confirm handover', isRequired: true, orderIndex: 0 }]
            }
        });
        assert.equal(templateRes.statusCode, 201, templateRes.body);
        const template = JSON.parse(templateRes.body).data;
        templateId = template.id;
        checklistItemId = template.items[0].id;

        const cycleUpdateRes = await app.inject({
            method: 'PATCH',
            url: `/api/v1/maintenance/cycles/${cycleId}`,
            headers: { cookie: `${config.cookie.name}=${itToken}` },
            payload: { defaultChecklistTemplateId: templateId }
        });
        assert.equal(cycleUpdateRes.statusCode, 200, cycleUpdateRes.body);

        const windowRes = await app.inject({
            method: 'POST',
            url: '/api/v1/maintenance/windows',
            headers: { cookie: `${config.cookie.name}=${itToken}` },
            payload: {
                cycleConfigId: cycleId,
                scheduledStartDate: new Date().toISOString(),
                deviceTypes: ['LAPTOP']
            }
        });
        assert.equal(windowRes.statusCode, 201, windowRes.body);
        windowId = JSON.parse(windowRes.body).data.id;

        const assignRes = await app.inject({
            method: 'POST',
            url: `/api/v1/maintenance/windows/${windowId}/assign`,
            headers: { cookie: `${config.cookie.name}=${itToken}` },
            payload: { userId: assigneeUser.id }
        });
        assert.equal(assignRes.statusCode, 200, assignRes.body);

        const signoffRes = await app.inject({
            method: 'POST',
            url: `/api/v1/maintenance/windows/${windowId}/sign-off`,
            headers: { cookie: `${config.cookie.name}=${assigneeToken}` },
            payload: {
                notes: 'Signed by device owner',
                completedItems: [
                    {
                        checklistItemId,
                        itemTitle: 'Confirm handover',
                        isRequired: true,
                        isCompleted: true
                    }
                ],
                assistedSigner: {
                    name: 'Device Owner',
                    signatureDataUrl: SIGNATURE_DATA_URL
                }
            }
        });

        assert.equal(signoffRes.statusCode, 200, signoffRes.body);
        const completion = JSON.parse(signoffRes.body).data;
        assert.equal(completion.signoffMode, 'ASSISTED');
        assert.ok(completion.signerSignatureUrl);
        signatureUrl = completion.signerSignatureUrl;
    });

    await t.test('signature file can be viewed by any authenticated user', async () => {
        const assigneeRes = await app.inject({
            method: 'GET',
            url: signatureUrl,
            headers: { cookie: `${config.cookie.name}=${assigneeToken}` }
        });
        assert.equal(assigneeRes.statusCode, 200, assigneeRes.body);

        const itRes = await app.inject({
            method: 'GET',
            url: signatureUrl,
            headers: { cookie: `${config.cookie.name}=${itToken}` }
        });
        assert.equal(itRes.statusCode, 200, itRes.body);

        const otherRequesterRes = await app.inject({
            method: 'GET',
            url: signatureUrl,
            headers: { cookie: `${config.cookie.name}=${otherToken}` }
        });
        assert.equal(otherRequesterRes.statusCode, 200, otherRequesterRes.body);

        const unauthenticatedRes = await app.inject({
            method: 'GET',
            url: signatureUrl
        });
        assert.equal(unauthenticatedRes.statusCode, 401, unauthenticatedRes.body);
    });

    await t.test('nonexistent signature file returns 404', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/uploads/pm-signature-does-not-exist.png',
            headers: { cookie: `${config.cookie.name}=${itToken}` }
        });
        assert.equal(response.statusCode, 404, response.body);
    });

    await t.test('cleanup', async () => {
        if (windowId) {
            await prisma.checklistItemCompletion.deleteMany({
                where: { completion: { windowId } }
            }).catch(() => { });
            await prisma.maintenanceCompletion.deleteMany({ where: { windowId } }).catch(() => { });
            await prisma.maintenanceWindowDeviceType.deleteMany({ where: { windowId } }).catch(() => { });
            await prisma.maintenanceWindow.deleteMany({ where: { id: windowId } }).catch(() => { });
        }

        if (templateId) {
            await prisma.maintenanceChecklistTemplate.delete({ where: { id: templateId } }).catch(() => { });
        }

        if (cycleId) {
            await prisma.maintenanceCycleConfig.delete({ where: { id: cycleId } }).catch(() => { });
        }

        const userIds = [itUser?.id, assigneeUser?.id, otherRequester?.id].filter(Boolean);
        if (userIds.length > 0) {
            await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => { });
        }

        await fs.rm(activeUploadDir, { recursive: true, force: true });

        if (previousUploadDir === undefined) {
            delete process.env.UPLOAD_DIR;
        } else {
            process.env.UPLOAD_DIR = previousUploadDir;
        }

        await prisma.$disconnect();
        await app.close();
    });
});
