/* eslint-disable */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");

import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";
import { getAuthConfig } from "../../apps/api/src/config/authConfig.js";
import appPlugin from "../../apps/api/src/server.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

const SIGNATURE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P8z8DwHwAE/wJ/lYI0WQAAAABJRU5ErkJggg==';

async function build() {
    const app = Fastify();
    await app.register(appPlugin);
    return app;
}

let app;
let itUser;
let requesterUser;
let itToken;
let requesterToken;
let config;
let cycleId;
let templateId;
let checklistItemId;
const createdWindowIds = [];

const signOffPayload = (checklistItemId, overrides = {}) => ({
    notes: 'All good',
    completedItems: [
        {
            checklistItemId,
            itemTitle: 'Check This',
            isRequired: true,
            isCompleted: true
        }
    ],
    ...overrides
});

before(async () => {
    config = getAuthConfig();
    app = await build();

    itUser = await prisma.user.create({
        data: {
            username: `it-comp-${randomUUID()}`,
            role: 'it',
            status: 'active'
        }
    });

    requesterUser = await prisma.user.create({
        data: {
            username: `req-comp-${randomUUID()}`,
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
    if (createdWindowIds.length > 0) {
        await prisma.checklistItemCompletion.deleteMany({
            where: { completion: { windowId: { in: createdWindowIds } } }
        }).catch(() => { });

        await prisma.maintenanceCompletion.deleteMany({
            where: { windowId: { in: createdWindowIds } }
        }).catch(() => { });

        await prisma.maintenanceWindowDeviceType.deleteMany({
            where: { windowId: { in: createdWindowIds } }
        }).catch(() => { });

        await prisma.maintenanceWindow.deleteMany({
            where: { id: { in: createdWindowIds } }
        }).catch(() => { });
    }

    if (templateId) {
        await prisma.maintenanceChecklistTemplate.delete({ where: { id: templateId } }).catch(() => { });
    }

    if (cycleId) {
        await prisma.maintenanceCycleConfig.delete({ where: { id: cycleId } }).catch(() => { });
    }

    await prisma.user.deleteMany({
        where: { id: { in: [itUser?.id, requesterUser?.id].filter(Boolean) } }
    }).catch(() => { });

    await prisma.$disconnect();
    await app.close();
});

test('Maintenance Completion - standard + assisted sign-off', async (t) => {
    let standardWindowId;
    let assistedWindowId;
    let requesterBlockedWindowId;

    await t.test('setup cycle/template/window data', async () => {
        const cycleRes = await app.inject({
            method: 'POST',
            url: '/api/v1/maintenance/cycles',
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: { name: `Completion Test Cycle ${randomUUID()}`, intervalMonths: 1 }
        });
        assert.equal(cycleRes.statusCode, 201, cycleRes.body);
        cycleId = JSON.parse(cycleRes.body).data.id;

        const templateRes = await app.inject({
            method: 'POST',
            url: '/api/v1/maintenance/checklists',
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                name: `Comp Template ${randomUUID()}`,
                items: [{ title: 'Check This', isRequired: true, orderIndex: 0 }]
            }
        });
        assert.equal(templateRes.statusCode, 201, templateRes.body);
        const template = JSON.parse(templateRes.body).data;
        templateId = template.id;
        checklistItemId = template.items[0].id;

        const cycleUpdateRes = await app.inject({
            method: 'PATCH',
            url: `/api/v1/maintenance/cycles/${cycleId}`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: { defaultChecklistTemplateId: templateId }
        });
        assert.equal(cycleUpdateRes.statusCode, 200, cycleUpdateRes.body);
    });

    await t.test('standard sign-off still works unchanged', async () => {
        const windowRes = await app.inject({
            method: 'POST',
            url: '/api/v1/maintenance/windows',
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                cycleConfigId: cycleId,
                scheduledStartDate: new Date().toISOString(),
                deviceTypes: ['LAPTOP']
            }
        });
        assert.equal(windowRes.statusCode, 201, windowRes.body);
        standardWindowId = JSON.parse(windowRes.body).data.id;
        createdWindowIds.push(standardWindowId);

        const assignRes = await app.inject({
            method: 'POST',
            url: `/api/v1/maintenance/windows/${standardWindowId}/assign`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: { userId: itUser.id }
        });
        assert.equal(assignRes.statusCode, 200, assignRes.body);

        const incompleteResponse = await app.inject({
            method: 'POST',
            url: `/api/v1/maintenance/windows/${standardWindowId}/sign-off`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                notes: 'Incomplete required checklist',
                completedItems: [
                    {
                        checklistItemId,
                        itemTitle: 'Check This',
                        isRequired: true,
                        isCompleted: false
                    }
                ]
            }
        });
        assert.equal(incompleteResponse.statusCode, 400);

        const response = await app.inject({
            method: 'POST',
            url: `/api/v1/maintenance/windows/${standardWindowId}/sign-off`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: signOffPayload(checklistItemId)
        });

        assert.equal(response.statusCode, 200, response.body);
        const body = JSON.parse(response.body);
        assert.equal(body.data.signoffMode, 'STANDARD');
        assert.equal(body.data.signerName, null);
        assert.equal(body.data.signerSignatureUrl, null);
        assert.equal(body.data.signerConfirmedAt, null);

        const duplicateResponse = await app.inject({
            method: 'POST',
            url: `/api/v1/maintenance/windows/${standardWindowId}/sign-off`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: signOffPayload(checklistItemId)
        });
        assert.equal(duplicateResponse.statusCode, 409);
    });

    await t.test('completion and history endpoints include signer fields', async () => {
        const completionResponse = await app.inject({
            method: 'GET',
            url: `/api/v1/maintenance/windows/${standardWindowId}/completion`,
            headers: { cookie: `it-hub-session=${requesterToken}` }
        });
        assert.equal(completionResponse.statusCode, 200, completionResponse.body);

        const completionData = JSON.parse(completionResponse.body).data;
        assert.equal(completionData.signoffMode, 'STANDARD');
        assert.equal(completionData.signerName, null);
        assert.equal(completionData.signerSignatureUrl, null);
        assert.equal(completionData.signerConfirmedAt, null);

        const historyResponse = await app.inject({
            method: 'GET',
            url: '/api/v1/maintenance/completions/my-history',
            headers: { cookie: `it-hub-session=${itToken}` }
        });
        assert.equal(historyResponse.statusCode, 200, historyResponse.body);

        const historyRows = JSON.parse(historyResponse.body).data;
        const row = historyRows.find((record) => record.windowId === standardWindowId);
        assert.ok(row, 'Expected standard completion in history response');
        assert.equal(row.signoffMode, 'STANDARD');
        assert.equal(row.signerName, null);
        assert.equal(row.signerSignatureUrl, null);
        assert.equal(row.signerConfirmedAt, null);
    });

    await t.test('any authenticated assigned user can sign off with assisted signer payload', async () => {
        const windowRes = await app.inject({
            method: 'POST',
            url: '/api/v1/maintenance/windows',
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                cycleConfigId: cycleId,
                scheduledStartDate: new Date(Date.now() + 60_000).toISOString(),
                deviceTypes: ['SERVER']
            }
        });
        assert.equal(windowRes.statusCode, 201, windowRes.body);
        assistedWindowId = JSON.parse(windowRes.body).data.id;
        createdWindowIds.push(assistedWindowId);

        const assignRes = await app.inject({
            method: 'POST',
            url: `/api/v1/maintenance/windows/${assistedWindowId}/assign`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: { userId: requesterUser.id }
        });
        assert.equal(assignRes.statusCode, 200, assignRes.body);

        const eligibilityRes = await app.inject({
            method: 'GET',
            url: `/api/v1/maintenance/windows/${assistedWindowId}/sign-off-eligibility`,
            headers: { cookie: `it-hub-session=${requesterToken}` }
        });
        assert.equal(eligibilityRes.statusCode, 200, eligibilityRes.body);
        assert.equal(JSON.parse(eligibilityRes.body).data.canSignOff, true);

        const missingNameRes = await app.inject({
            method: 'POST',
            url: `/api/v1/maintenance/windows/${assistedWindowId}/sign-off`,
            headers: { cookie: `it-hub-session=${requesterToken}` },
            payload: signOffPayload(checklistItemId, {
                assistedSigner: {
                    signatureDataUrl: SIGNATURE_DATA_URL
                }
            })
        });
        assert.equal(missingNameRes.statusCode, 400, missingNameRes.body);

        const missingSignatureRes = await app.inject({
            method: 'POST',
            url: `/api/v1/maintenance/windows/${assistedWindowId}/sign-off`,
            headers: { cookie: `it-hub-session=${requesterToken}` },
            payload: signOffPayload(checklistItemId, {
                assistedSigner: {
                    name: 'No Signature'
                }
            })
        });
        assert.equal(missingSignatureRes.statusCode, 400, missingSignatureRes.body);

        const invalidDataUrlRes = await app.inject({
            method: 'POST',
            url: `/api/v1/maintenance/windows/${assistedWindowId}/sign-off`,
            headers: { cookie: `it-hub-session=${requesterToken}` },
            payload: signOffPayload(checklistItemId, {
                assistedSigner: {
                    name: 'Invalid Data URL',
                    signatureDataUrl: 'data:text/plain;base64,Zm9v'
                }
            })
        });
        assert.equal(invalidDataUrlRes.statusCode, 400, invalidDataUrlRes.body);

        const oversizedDataUrl = `data:image/png;base64,${Buffer.alloc((300 * 1024) + 1, 1).toString('base64')}`;
        const oversizedRes = await app.inject({
            method: 'POST',
            url: `/api/v1/maintenance/windows/${assistedWindowId}/sign-off`,
            headers: { cookie: `it-hub-session=${requesterToken}` },
            payload: signOffPayload(checklistItemId, {
                assistedSigner: {
                    name: 'Too Large',
                    signatureDataUrl: oversizedDataUrl
                }
            })
        });
        assert.equal(oversizedRes.statusCode, 400, oversizedRes.body);

        const assistedRes = await app.inject({
            method: 'POST',
            url: `/api/v1/maintenance/windows/${assistedWindowId}/sign-off`,
            headers: { cookie: `it-hub-session=${requesterToken}` },
            payload: signOffPayload(checklistItemId, {
                notes: 'Assisted handover done',
                assistedSigner: {
                    name: 'Device Owner',
                    signatureDataUrl: SIGNATURE_DATA_URL
                }
            })
        });

        assert.equal(assistedRes.statusCode, 200, assistedRes.body);
        const assistedBody = JSON.parse(assistedRes.body).data;
        assert.equal(assistedBody.completedBy.id, requesterUser.id);
        assert.equal(assistedBody.signoffMode, 'ASSISTED');
        assert.equal(assistedBody.signerName, 'Device Owner');
        assert.ok(assistedBody.signerConfirmedAt);
        assert.match(assistedBody.signerSignatureUrl, /^\/api\/v1\/uploads\/pm-signature-/);

        const assistedCompletionRes = await app.inject({
            method: 'GET',
            url: `/api/v1/maintenance/windows/${assistedWindowId}/completion`,
            headers: { cookie: `it-hub-session=${itToken}` }
        });
        assert.equal(assistedCompletionRes.statusCode, 200, assistedCompletionRes.body);
        const assistedCompletion = JSON.parse(assistedCompletionRes.body).data;
        assert.equal(assistedCompletion.signoffMode, 'ASSISTED');
        assert.equal(assistedCompletion.signerName, 'Device Owner');
        assert.ok(assistedCompletion.signerSignatureUrl);

        const requesterHistoryRes = await app.inject({
            method: 'GET',
            url: '/api/v1/maintenance/completions/my-history',
            headers: { cookie: `it-hub-session=${requesterToken}` }
        });
        assert.equal(requesterHistoryRes.statusCode, 200, requesterHistoryRes.body);
        const requesterRows = JSON.parse(requesterHistoryRes.body).data;
        const assistedRow = requesterRows.find((record) => record.windowId === assistedWindowId);
        assert.ok(assistedRow, 'Expected assisted completion in requester history');
        assert.equal(assistedRow.signoffMode, 'ASSISTED');
        assert.equal(assistedRow.signerName, 'Device Owner');
        assert.ok(assistedRow.signerSignatureUrl);
    });

    await t.test('assignment eligibility still blocks unassigned requester', async () => {
        const windowRes = await app.inject({
            method: 'POST',
            url: '/api/v1/maintenance/windows',
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                cycleConfigId: cycleId,
                scheduledStartDate: new Date(Date.now() + 120_000).toISOString(),
                deviceTypes: ['DESKTOP_PC']
            }
        });
        assert.equal(windowRes.statusCode, 201, windowRes.body);
        requesterBlockedWindowId = JSON.parse(windowRes.body).data.id;
        createdWindowIds.push(requesterBlockedWindowId);

        const assignRes = await app.inject({
            method: 'POST',
            url: `/api/v1/maintenance/windows/${requesterBlockedWindowId}/assign`,
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: { userId: itUser.id }
        });
        assert.equal(assignRes.statusCode, 200, assignRes.body);

        const signOffRes = await app.inject({
            method: 'POST',
            url: `/api/v1/maintenance/windows/${requesterBlockedWindowId}/sign-off`,
            headers: { cookie: `it-hub-session=${requesterToken}` },
            payload: signOffPayload(checklistItemId)
        });
        assert.equal(signOffRes.statusCode, 403, signOffRes.body);
    });
});
