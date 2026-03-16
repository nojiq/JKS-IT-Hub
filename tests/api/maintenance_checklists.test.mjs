/* eslint-disable */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const Fastify = require('fastify');

import appPlugin from '../../apps/api/src/server.js';
import { prisma } from '../../apps/api/src/shared/db/prisma.js';
import { signSessionToken } from '../../apps/api/src/shared/auth/jwt.js';
import { getAuthConfig } from '../../apps/api/src/config/authConfig.js';
import * as maintenanceRepo from '../../apps/api/src/features/maintenance/repo.js';

async function build() {
    const app = Fastify();
    await app.register(appPlugin);
    return app;
}

let app;
let config;
let itUser;
let requesterUser;
let itToken;
let requesterToken;

const testIds = {
    checklistIds: [],
    cycleIds: [],
    windowIds: []
};

const api = async ({ method, url, token, payload }) => {
    return app.inject({
        method,
        url,
        headers: token ? { cookie: `it-hub-session=${token}` } : {},
        payload
    });
};

before(async () => {
    config = getAuthConfig();
    app = await build();

    itUser = await prisma.user.create({
        data: {
            username: `it-checklists-${randomUUID()}`,
            role: 'it',
            status: 'active'
        }
    });

    requesterUser = await prisma.user.create({
        data: {
            username: `req-checklists-${randomUUID()}`,
            role: 'requester',
            status: 'active'
        }
    });

    itToken = await signSessionToken({
        subject: itUser.id,
        payload: { username: itUser.username, role: itUser.role }
    }, config.jwt);

    requesterToken = await signSessionToken({
        subject: requesterUser.id,
        payload: { username: requesterUser.username, role: requesterUser.role }
    }, config.jwt);
});

after(async () => {
    if (testIds.windowIds.length) {
        await prisma.maintenanceWindow.deleteMany({ where: { id: { in: testIds.windowIds } } });
    }
    if (testIds.cycleIds.length) {
        await prisma.maintenanceCycleConfig.deleteMany({ where: { id: { in: testIds.cycleIds } } });
    }
    if (testIds.checklistIds.length) {
        await prisma.maintenanceChecklistTemplate.deleteMany({ where: { id: { in: testIds.checklistIds } } });
    }

    await prisma.user.deleteMany({ where: { id: { in: [itUser.id, requesterUser.id] } } });
    await app.close();
    await prisma.$disconnect();
});

test('Maintenance Checklists - Core Behavior', async (t) => {
    let checklistA;
    let checklistB;
    let cycle;
    let firstWindow;

    await t.test('repo checklist item functions exist', async () => {
        assert.equal(typeof maintenanceRepo.createChecklistItems, 'function');
        assert.equal(typeof maintenanceRepo.updateChecklistItems, 'function');
        assert.equal(typeof maintenanceRepo.deleteChecklistItems, 'function');
    });

    await t.test('requester cannot create checklist template', async () => {
        const response = await api({
            method: 'POST',
            url: '/api/v1/maintenance/checklists',
            token: requesterToken,
            payload: {
                name: `Checklist RBAC ${randomUUID()}`,
                items: [{ title: 'Only IT should do this', isRequired: true, orderIndex: 0 }]
            }
        });

        assert.equal(response.statusCode, 403);
    });

    await t.test('it can create checklist templates', async () => {
        const responseA = await api({
            method: 'POST',
            url: '/api/v1/maintenance/checklists',
            token: itToken,
            payload: {
                name: `Checklist A ${randomUUID()}`,
                description: 'Template A',
                items: [
                    { title: 'Check updates', description: 'OS updates', isRequired: true, orderIndex: 0 },
                    { title: 'Clean hardware', isRequired: false, orderIndex: 1 }
                ]
            }
        });

        assert.equal(responseA.statusCode, 201);
        checklistA = JSON.parse(responseA.body).data;
        assert.equal(checklistA.version, 1);
        assert.equal(checklistA.items.length, 2);
        testIds.checklistIds.push(checklistA.id);

        const responseB = await api({
            method: 'POST',
            url: '/api/v1/maintenance/checklists',
            token: itToken,
            payload: {
                name: `Checklist B ${randomUUID()}`,
                description: 'Template B',
                items: [{ title: 'Second template item', isRequired: true, orderIndex: 0 }]
            }
        });

        assert.equal(responseB.statusCode, 201);
        checklistB = JSON.parse(responseB.body).data;
        testIds.checklistIds.push(checklistB.id);
    });

    await t.test('duplicate checklist name on update returns 409 conflict', async () => {
        const response = await api({
            method: 'PATCH',
            url: `/api/v1/maintenance/checklists/${checklistB.id}`,
            token: itToken,
            payload: { name: checklistA.name }
        });

        assert.equal(response.statusCode, 409);
    });

    await t.test('attach checklist to cycle and generate window with checklist snapshot', async () => {
        const cycleResponse = await api({
            method: 'POST',
            url: '/api/v1/maintenance/cycles',
            token: itToken,
            payload: {
                name: `Cycle ${randomUUID()}`,
                intervalMonths: 3,
                defaultChecklistTemplateId: checklistA.id
            }
        });

        assert.equal(cycleResponse.statusCode, 201);
        cycle = JSON.parse(cycleResponse.body).data;
        testIds.cycleIds.push(cycle.id);

        const scheduleResponse = await api({
            method: 'POST',
            url: `/api/v1/maintenance/cycles/${cycle.id}/generate-schedule`,
            token: itToken,
            payload: { monthsAhead: 12 }
        });

        assert.equal(scheduleResponse.statusCode, 200);

        const windowsResponse = await api({
            method: 'GET',
            url: `/api/v1/maintenance/windows?cycleId=${cycle.id}`,
            token: itToken
        });

        assert.equal(windowsResponse.statusCode, 200);
        const windows = JSON.parse(windowsResponse.body).data;
        assert.ok(windows.length >= 1);
        firstWindow = windows[0];
        testIds.windowIds.push(...windows.map((window) => window.id));

        const detailResponse = await api({
            method: 'GET',
            url: `/api/v1/maintenance/windows/${firstWindow.id}`,
            token: itToken
        });

        assert.equal(detailResponse.statusCode, 200);
        const detail = JSON.parse(detailResponse.body).data;
        assert.equal(detail.checklistVersion, 1);
        assert.ok(Array.isArray(detail.checklistSnapshot?.items));
        assert.equal(detail.checklistSnapshot.items.length, 2);
        assert.equal(detail.checklistSnapshot.items[0].title, 'Check updates');
    });

    await t.test('updating template increments version and existing windows keep prior snapshot', async () => {
        const updateResponse = await api({
            method: 'PATCH',
            url: `/api/v1/maintenance/checklists/${checklistA.id}`,
            token: itToken,
            payload: {
                description: 'Template A updated',
                items: [
                    { title: 'Check updates (new)', description: 'OS and firmware', isRequired: true, orderIndex: 0 },
                    { title: 'Security scan', isRequired: true, orderIndex: 1 },
                    { title: 'Clean hardware', isRequired: false, orderIndex: 2 }
                ]
            }
        });

        assert.equal(updateResponse.statusCode, 200);
        const updated = JSON.parse(updateResponse.body).data;
        assert.equal(updated.version, 2);

        const existingWindowDetail = await api({
            method: 'GET',
            url: `/api/v1/maintenance/windows/${firstWindow.id}`,
            token: itToken
        });

        assert.equal(existingWindowDetail.statusCode, 200);
        const existing = JSON.parse(existingWindowDetail.body).data;
        assert.equal(existing.checklistVersion, 1);
        assert.equal(existing.checklistSnapshot.version, 1);
        assert.equal(existing.checklistSnapshot.items[0].title, 'Check updates');

        const regen = await api({
            method: 'POST',
            url: `/api/v1/maintenance/cycles/${cycle.id}/generate-schedule`,
            token: itToken,
            payload: { monthsAhead: 24 }
        });

        assert.equal(regen.statusCode, 200);

        const allWindowsResponse = await api({
            method: 'GET',
            url: `/api/v1/maintenance/windows?cycleId=${cycle.id}`,
            token: itToken
        });

        assert.equal(allWindowsResponse.statusCode, 200);
        const allWindows = JSON.parse(allWindowsResponse.body).data;
        const latestVersionWindow = allWindows.find((window) => window.checklistVersion === 2);
        assert.ok(latestVersionWindow, 'Expected at least one newly generated window using checklist version 2');

        const newWindowIds = allWindows
            .map((window) => window.id)
            .filter((id) => !testIds.windowIds.includes(id));
        if (newWindowIds.length > 0) {
            testIds.windowIds.push(...newWindowIds);
        }
    });
});
