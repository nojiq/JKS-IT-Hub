import test from 'node:test';
import assert from 'node:assert/strict';
import {
    emitToUser,
    emitToRole,
    emitToUsers,
    emitToITStaff,
    emitToAll,
    getConnectedUserIdsByRoles,
    getConnectionStats,
    __test
} from '../../apps/api/src/features/notifications/sseHandler.js';

const createConnection = () => {
    const messages = [];
    return {
        messages,
        write(chunk) {
            messages.push(chunk);
        }
    };
};

const parseEventChunk = (chunk) => {
    const match = chunk.match(/^event: ([^\n]+)\ndata: (.+)\n\n$/s);
    assert.ok(match, `Invalid SSE chunk: ${chunk}`);
    return {
        eventType: match[1],
        payload: JSON.parse(match[2])
    };
};

test.beforeEach(() => {
    __test.reset();
});

test('emitToUser sends SSE envelope to all active user connections', () => {
    const connA = createConnection();
    const connB = createConnection();
    __test.addConnection('user-1', 'requester', connA);
    __test.addConnection('user-1', 'requester', connB);

    emitToUser('user-1', {
        type: 'request.updated',
        data: { requestId: 'req-1' }
    });

    assert.equal(connA.messages.length, 1);
    assert.equal(connB.messages.length, 1);

    const parsed = parseEventChunk(connA.messages[0]);
    assert.equal(parsed.eventType, 'request.updated');
    assert.equal(parsed.payload.type, 'request.updated');
    assert.equal(parsed.payload.data.requestId, 'req-1');
    assert.ok(parsed.payload.id);
    assert.ok(parsed.payload.timestamp);
});

test('emitToRole only targets connected users with that role', () => {
    const itConn = createConnection();
    const requesterConn = createConnection();
    __test.addConnection('user-it', 'it', itConn);
    __test.addConnection('user-req', 'requester', requesterConn);

    emitToRole('it', {
        type: 'request.created',
        data: { requestId: 'req-2' }
    });

    assert.equal(itConn.messages.length, 1);
    assert.equal(requesterConn.messages.length, 0);
});

test('emitToITStaff fans out to it/admin/head_it roles', () => {
    const itConn = createConnection();
    const adminConn = createConnection();
    const headConn = createConnection();
    const requesterConn = createConnection();

    __test.addConnection('u-it', 'it', itConn);
    __test.addConnection('u-admin', 'admin', adminConn);
    __test.addConnection('u-head', 'head_it', headConn);
    __test.addConnection('u-req', 'requester', requesterConn);

    emitToITStaff({
        type: 'maintenance.updated',
        data: { windowId: 'mw-1' }
    });

    assert.equal(itConn.messages.length, 1);
    assert.equal(adminConn.messages.length, 1);
    assert.equal(headConn.messages.length, 1);
    assert.equal(requesterConn.messages.length, 0);
});

test('emitToUsers and emitToAll deliver to expected recipients', () => {
    const a = createConnection();
    const b = createConnection();
    const c = createConnection();

    __test.addConnection('user-a', 'it', a);
    __test.addConnection('user-b', 'requester', b);
    __test.addConnection('user-c', 'admin', c);

    emitToUsers(['user-a', 'user-c'], {
        type: 'notification',
        data: { id: 'n1' }
    });

    assert.equal(a.messages.length, 1);
    assert.equal(b.messages.length, 0);
    assert.equal(c.messages.length, 1);

    emitToAll({
        type: 'maintenance.completed',
        data: { windowId: 'mw-2' }
    });

    assert.equal(a.messages.length, 2);
    assert.equal(b.messages.length, 1);
    assert.equal(c.messages.length, 2);
});

test('connection stats and connected-role lookup reflect active connections', () => {
    __test.addConnection('u1', 'it', createConnection());
    __test.addConnection('u1', 'it', createConnection());
    __test.addConnection('u2', 'admin', createConnection());
    __test.addConnection('u3', 'requester', createConnection());

    const stats = getConnectionStats();
    assert.equal(stats.uniqueUsers, 3);
    assert.equal(stats.totalConnections, 4);

    const itRelated = getConnectedUserIdsByRoles(['it', 'admin', 'head_it']);
    assert.deepEqual(new Set(itRelated), new Set(['u1', 'u2']));
});

test('failed socket writes are pruned from active user connections', () => {
    const broken = {
        write() {
            throw new Error('socket closed');
        }
    };
    __test.addConnection('u-broken', 'it', broken);

    emitToUser('u-broken', {
        type: 'request.updated',
        data: { requestId: 'req-broken' }
    });

    const stats = getConnectionStats();
    assert.equal(stats.uniqueUsers, 0);
    assert.equal(stats.totalConnections, 0);
});
