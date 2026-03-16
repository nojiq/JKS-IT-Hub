import test from 'node:test';
import assert from 'node:assert/strict';
import {
    emitRequestCreated,
    emitRequestUpdated,
    emitRequestStatusChanged
} from '../../apps/api/src/features/requests/events.js';
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

test('request.created reaches requester + IT/Admin/Head recipients only', () => {
    const requester = createConnection();
    const itUser = createConnection();
    const adminUser = createConnection();
    const headUser = createConnection();
    const unrelatedRequester = createConnection();

    __test.addConnection('req-1', 'requester', requester);
    __test.addConnection('it-1', 'it', itUser);
    __test.addConnection('admin-1', 'admin', adminUser);
    __test.addConnection('head-1', 'head_it', headUser);
    __test.addConnection('req-2', 'requester', unrelatedRequester);

    emitRequestCreated({
        id: 'request-1',
        requesterId: 'req-1',
        itemName: 'Laptop',
        status: 'SUBMITTED',
        priority: 'MEDIUM',
        createdAt: '2026-02-10T00:00:00.000Z'
    }, {
        id: 'req-1',
        username: 'requester.user'
    });

    assert.deepEqual(eventTypes(requester), ['request.created']);
    assert.deepEqual(eventTypes(itUser), ['request.created']);
    assert.deepEqual(eventTypes(adminUser), ['request.created']);
    assert.deepEqual(eventTypes(headUser), ['request.created']);
    assert.deepEqual(eventTypes(unrelatedRequester), []);
});

test('request.updated includes actor metadata in payload', () => {
    const requester = createConnection();
    const itUser = createConnection();

    __test.addConnection('req-3', 'requester', requester);
    __test.addConnection('it-2', 'it', itUser);

    emitRequestUpdated({
        id: 'request-2',
        requesterId: 'req-3'
    }, {
        id: 'it-2',
        username: 'it.user'
    });

    const requesterEvent = parseEvent(requester.messages[0]);
    assert.equal(requesterEvent.eventType, 'request.updated');
    assert.equal(requesterEvent.payload.data.actorId, 'it-2');
    assert.equal(requesterEvent.payload.data.actorName, 'it.user');
});

test('status change emits canonical and status-specific request events', () => {
    const requester = createConnection();
    const adminUser = createConnection();

    __test.addConnection('req-4', 'requester', requester);
    __test.addConnection('admin-4', 'admin', adminUser);

    emitRequestStatusChanged({
        id: 'request-3',
        requesterId: 'req-4',
        status: 'APPROVED',
        itemName: 'Docking Station'
    }, 'IT_REVIEWED', {
        id: 'admin-4',
        username: 'admin.user'
    });

    assert.deepEqual(eventTypes(requester), ['request.status_changed', 'request.approved']);
    assert.deepEqual(eventTypes(adminUser), ['request.status_changed', 'request.approved']);

    const statusChangedPayload = parseEvent(requester.messages[0]).payload.data;
    assert.equal(statusChangedPayload.requestId, 'request-3');
    assert.equal(statusChangedPayload.previousStatus, 'IT_REVIEWED');
    assert.equal(statusChangedPayload.newStatus, 'APPROVED');
    assert.equal(statusChangedPayload.actorId, 'admin-4');
});
