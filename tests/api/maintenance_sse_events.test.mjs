import test from 'node:test';
import assert from 'node:assert/strict';
import {
    emitMaintenanceStatusChanged,
    emitMaintenanceCompleted,
    emitMaintenanceUpcoming,
    emitMaintenanceOverdue
} from '../../apps/api/src/features/maintenance/events.js';
import { __test } from '../../apps/api/src/features/notifications/sseHandler.js';

const createConnection = () => {
    const messages = [];
    return {
        messages,
        write(chunk) {
            messages.push(chunk);
        }
    };
};

const parseEvent = (chunk) => {
    const match = chunk.match(/^event: ([^\n]+)\ndata: (.+)\n\n$/s);
    assert.ok(match, `Invalid SSE chunk: ${chunk}`);
    return {
        eventType: match[1],
        payload: JSON.parse(match[2])
    };
};

const eventTypes = (connection) => connection.messages.map((chunk) => parseEvent(chunk).eventType);

test.beforeEach(() => {
    __test.reset();
});

test('maintenance.updated/upcoming are sent to assignee + IT/Admin/Head only', () => {
    const technician = createConnection();
    const itUser = createConnection();
    const adminUser = createConnection();
    const headUser = createConnection();
    const unrelatedRequester = createConnection();

    __test.addConnection('tech-1', 'requester', technician);
    __test.addConnection('it-1', 'it', itUser);
    __test.addConnection('admin-1', 'admin', adminUser);
    __test.addConnection('head-1', 'head_it', headUser);
    __test.addConnection('req-1', 'requester', unrelatedRequester);

    emitMaintenanceStatusChanged({
        id: 'mw-1',
        assignedToId: 'tech-1',
        cycleConfigId: 'cycle-1',
        status: 'UPCOMING',
        scheduledStartDate: '2026-02-12T00:00:00.000Z',
        scheduledEndDate: null,
        updatedAt: '2026-02-10T00:00:00.000Z'
    }, 'SCHEDULED', {
        id: 'it-1',
        username: 'it.user'
    });

    assert.deepEqual(eventTypes(technician), ['maintenance.updated', 'maintenance.upcoming']);
    assert.deepEqual(eventTypes(itUser), ['maintenance.updated', 'maintenance.upcoming']);
    assert.deepEqual(eventTypes(adminUser), ['maintenance.updated', 'maintenance.upcoming']);
    assert.deepEqual(eventTypes(headUser), ['maintenance.updated', 'maintenance.upcoming']);
    assert.deepEqual(eventTypes(unrelatedRequester), []);
});

test('maintenance.completed emits completed event with expected payload', () => {
    const technician = createConnection();
    const itUser = createConnection();

    __test.addConnection('tech-2', 'requester', technician);
    __test.addConnection('it-2', 'it', itUser);

    emitMaintenanceCompleted({
        id: 'mw-2',
        assignedToId: 'tech-2',
        completedAt: '2026-02-10T05:00:00.000Z',
        completionRemarks: 'All checks passed',
        signoffMode: 'ASSISTED',
        signerName: 'Jane Signer',
        signerConfirmedAt: '2026-02-10T05:00:00.000Z'
    }, {
        id: 'tech-2',
        username: 'technician.user'
    });

    assert.deepEqual(eventTypes(technician), ['maintenance.completed']);
    assert.deepEqual(eventTypes(itUser), ['maintenance.completed']);

    const payload = parseEvent(technician.messages[0]).payload.data;
    assert.equal(payload.windowId, 'mw-2');
    assert.equal(payload.completedBy, 'tech-2');
    assert.equal(payload.notes, 'All checks passed');
    assert.equal(payload.signoffMode, 'ASSISTED');
    assert.equal(payload.signerName, 'Jane Signer');
    assert.equal(payload.signerConfirmedAt, '2026-02-10T05:00:00.000Z');
});

test('explicit upcoming/overdue emitters publish dedicated event types', () => {
    const technician = createConnection();
    const adminUser = createConnection();

    __test.addConnection('tech-3', 'requester', technician);
    __test.addConnection('admin-3', 'admin', adminUser);

    const maintenanceWindow = {
        id: 'mw-3',
        assignedToId: 'tech-3',
        scheduledStartDate: '2026-02-15T00:00:00.000Z'
    };

    emitMaintenanceUpcoming(maintenanceWindow, 'SCHEDULED', { id: 'admin-3', username: 'admin.user' });
    emitMaintenanceOverdue(maintenanceWindow, 'UPCOMING', { id: 'admin-3', username: 'admin.user' });

    assert.deepEqual(eventTypes(technician), ['maintenance.upcoming', 'maintenance.overdue']);
    assert.deepEqual(eventTypes(adminUser), ['maintenance.upcoming', 'maintenance.overdue']);
});
