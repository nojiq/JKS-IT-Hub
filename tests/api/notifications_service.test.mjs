
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import * as service from '../../apps/api/src/features/notifications/service.js';

describe('Notification Service', () => {
    // Mock implementations
    const mockEmailService = { sendEmail: mock.fn(async () => ({ success: true, messageId: '1' })) };
    const mockRepo = {
        createNotificationRecord: mock.fn(async () => ({ id: '1' })),
        updateNotificationStatus: mock.fn(async () => { }),
        getNotificationsForRequest: mock.fn(async () => [])
    };
    const mockResolver = {
        getITStaffEmails: mock.fn(async () => ['it@example.com']),
        getUserEmail: mock.fn(async () => 'user@example.com'),
        getApproverEmails: mock.fn(async () => ['admin@example.com'])
    };
    const mockAuditRepo = { createAuditLog: mock.fn(async () => { }) };
    const mockTemplates = {
        newRequestSubmitted: mock.fn(() => ({ subject: 'S', html: 'H', text: 'T' })),
        requestReviewed: mock.fn(() => ({ subject: 'S', html: 'H', text: 'T' })),
        pendingApproval: mock.fn(() => ({ subject: 'S', html: 'H', text: 'T' })),
        requestApproved: mock.fn(() => ({ subject: 'S', html: 'H', text: 'T' })),
        requestRejected: mock.fn(() => ({ subject: 'S', html: 'H', text: 'T' }))
    };
    const mockLogger = {
        info: mock.fn(), warn: mock.fn(), error: mock.fn()
    };

    const deps = {
        sendEmail: mockEmailService.sendEmail,
        templates: mockTemplates,
        notificationRepo: mockRepo,
        recipientResolver: mockResolver,
        auditRepo: mockAuditRepo,
        logger: mockLogger
    };

    beforeEach(() => {
        // Reset calls
        [mockEmailService.sendEmail, ...Object.values(mockRepo), ...Object.values(mockResolver), ...Object.values(mockAuditRepo), ...Object.values(mockTemplates), ...Object.values(mockLogger)].forEach(fn => {
            if (fn.mock) fn.mock.resetCalls();
        });

        // Reset default behaviors
        mockResolver.getITStaffEmails.mock.mockImplementation(async () => ['it@example.com']);
    });

    it('notifyNewRequest should send to IT staff', async () => {
        const req = { id: 'req-1', itemName: 'Laptop', createdAt: new Date() };
        const user = { username: 'testuser' };

        await service.notifyNewRequest(req, user, deps);

        assert.strictEqual(mockResolver.getITStaffEmails.mock.calls.length, 1);
        assert.strictEqual(mockRepo.createNotificationRecord.mock.calls.length, 1);
        assert.strictEqual(mockEmailService.sendEmail.mock.calls.length, 1);

        const emailCall = mockEmailService.sendEmail.mock.calls[0];
        assert.deepStrictEqual(emailCall.arguments[0].to, ['it@example.com']);
    });

    it('notifyNewRequest should skip if no recipients', async () => {
        mockResolver.getITStaffEmails.mock.mockImplementation(async () => []);

        const req = { id: 'req-1', itemName: 'Laptop' };
        const user = { username: 'testuser' };

        await service.notifyNewRequest(req, user, deps);

        assert.strictEqual(mockEmailService.sendEmail.mock.calls.length, 0);
    });
});
