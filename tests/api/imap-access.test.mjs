import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { requireItRole } from '../../apps/api/src/shared/auth/middleware.js';

describe('requireItRole Middleware', () => {

    const createMockReply = () => {
        const reply = {
            status: mock.fn(() => reply),
            code: mock.fn(() => reply),
            type: mock.fn(() => reply),
            send: mock.fn()
        };
        return reply;
    };

    it('should allow "it" role', async () => {
        const req = { user: { id: 'u1', role: 'it' } };
        const reply = createMockReply();
        const auditRepo = { createAuditLog: mock.fn() };

        await requireItRole(req, reply, { auditRepo });

        assert.strictEqual(reply.code.mock.callCount(), 0);
        assert.strictEqual(reply.send.mock.callCount(), 0);
        assert.strictEqual(auditRepo.createAuditLog.mock.callCount(), 0);
    });

    it('should allow "head_it" role', async () => {
        const req = { user: { id: 'u2', role: 'head_it' } };
        const reply = createMockReply();
        const auditRepo = { createAuditLog: mock.fn() };

        await requireItRole(req, reply, { auditRepo });

        assert.strictEqual(reply.code.mock.callCount(), 0);
    });

    it('should allow "admin" role', async () => {
        const req = {
            user: { id: 'u3', role: 'admin' },
            body: { targetUserId: 'target-u1' }
        };
        const reply = createMockReply();
        const auditRepo = { createAuditLog: mock.fn() };

        await requireItRole(req, reply, { auditRepo });

        assert.strictEqual(reply.code.mock.callCount(), 0);
        assert.strictEqual(reply.send.mock.callCount(), 0);
        assert.strictEqual(auditRepo.createAuditLog.mock.callCount(), 0);
    });

    it('should deny "requester" role and log audit', async () => {
        const req = { user: { id: 'u4', role: 'requester' }, params: { userId: 'target-user' } };
        const reply = createMockReply();
        const auditRepo = { createAuditLog: mock.fn() };

        await requireItRole(req, reply, { auditRepo });

        assert.strictEqual(reply.code.mock.callCount(), 1);
        assert.strictEqual(reply.code.mock.calls[0].arguments[0], 403);
        assert.strictEqual(auditRepo.createAuditLog.mock.callCount(), 1);
        const auditCall = auditRepo.createAuditLog.mock.calls[0].arguments[0];
        assert.strictEqual(auditCall.action, 'credential.imap.access.denied');
        assert.strictEqual(auditCall.metadata.actualRole, 'requester');
        assert.strictEqual(auditCall.metadata.targetUserId, 'target-user');
    });

    it('should deny if no user (safety check)', async () => {
        const req = { user: undefined };
        const reply = createMockReply();
        const auditRepo = { createAuditLog: mock.fn() };

        await requireItRole(req, reply, { auditRepo });

        assert.strictEqual(reply.code.mock.callCount(), 1);
        assert.strictEqual(reply.code.mock.calls[0].arguments[0], 401);
    });
});
