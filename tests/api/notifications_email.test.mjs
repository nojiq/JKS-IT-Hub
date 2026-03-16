import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { sendEmail, __setTransporter } from '../../apps/api/src/features/notifications/email/emailService.js';
import { templates } from '../../apps/api/src/features/notifications/email/emailTemplates.js';

describe('Email Service', () => {
    let mockTransporter;
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.SMTP_HOST = 'smtp.example.com';
        process.env.SMTP_PORT = '587';
        process.env.SMTP_FROM = 'noreply@test.com';

        mockTransporter = {
            sendMail: mock.fn(async () => ({ messageId: 'test-message-id' }))
        };
        __setTransporter(mockTransporter);
    });

    afterEach(() => {
        process.env = originalEnv;
        mock.restoreAll();
    });

    it('should send email successfully', async () => {
        const result = await sendEmail({
            to: 'test@example.com',
            subject: 'Test Subject',
            html: '<p>Test</p>',
            text: 'Test'
        });

        assert.equal(result.success, true);
        assert.equal(result.messageId, 'test-message-id');
        assert.equal(mockTransporter.sendMail.mock.calls.length, 1);
        const callArgs = mockTransporter.sendMail.mock.calls[0].arguments[0];
        assert.equal(callArgs.to, 'test@example.com');
        assert.equal(callArgs.subject, 'Test Subject');
        assert.equal(callArgs.from, 'noreply@test.com');
    });

    it('should handle send failure and retry', async () => {
        // Mock first failure, second success
        let callCount = 0;
        mockTransporter.sendMail = mock.fn(async () => {
            callCount++;
            if (callCount === 1) throw new Error('SMTP Error');
            return { messageId: 'retry-message-id' };
        });

        const result = await sendEmail({
            to: 'test@example.com',
            subject: 'Test Subject',
            html: '<p>Test</p>',
            text: 'Test'
        });

        assert.equal(result.success, true);
        assert.equal(result.messageId, 'retry-message-id');
        assert.equal(mockTransporter.sendMail.mock.calls.length, 2);
    });

    it('should report failure after retry fails', async () => {
        mockTransporter.sendMail = mock.fn(async () => {
            throw new Error('Persistent SMTP Error');
        });

        const result = await sendEmail({
            to: 'test@example.com',
            subject: 'Test Subject',
            html: '<p>Test</p>',
            text: 'Test'
        });

        assert.equal(result.success, false);
        assert.equal(result.error, 'Persistent SMTP Error');
        assert.equal(mockTransporter.sendMail.mock.calls.length, 2);
    });

    it('should fail gracefully if SMTP is not configured', async () => {
        delete process.env.SMTP_HOST;

        const result = await sendEmail({
            to: 'test@example.com',
            subject: 'Test Subject',
            html: '<p>Test</p>',
            text: 'Test'
        });

        assert.equal(result.success, false);
        assert.equal(result.error, 'SMTP not configured');
        assert.equal(mockTransporter.sendMail.mock.calls.length, 0);
    });
});

describe('Email Templates', () => {
    it('should generate newRequestSubmitted template', () => {
        const data = {
            requestId: 'req-123',
            itemName: 'MacBook Pro',
            requesterName: 'Jane Doe',
            submittedAt: new Date('2023-01-01T12:00:00Z'),
            priority: 'High',
            description: 'Need for development'
        };
        const rendered = templates.newRequestSubmitted(data);

        assert.strictEqual(rendered.subject, '[IT-Hub] New Item Request: MacBook Pro');
        assert.ok(rendered.html.includes('Jane Doe'));
        assert.ok(rendered.html.includes('MacBook Pro'));
        assert.ok(rendered.html.includes('High'));
        assert.ok(rendered.text.includes('New Item Request Submitted'));
    });

    it('should generate requestReviewed template', () => {
        const data = {
            itemName: 'Monitor',
            reviewerName: 'IT Admin',
            statusLabel: 'IT Reviewed',
            statusClass: 'reviewed',
            reviewNotes: 'Approved for purchase',
            nextSteps: 'Wait for approval'
        };
        const rendered = templates.requestReviewed(data);

        assert.ok(rendered.subject.includes('Monitor'));
        assert.ok(rendered.subject.includes('IT Reviewed'));
        assert.ok(rendered.html.includes('IT Admin'));
        assert.ok(rendered.html.includes('Approved for purchase'));
    });

    it('should generate pendingApproval template', () => {
        const data = {
            requestId: 'req-456',
            itemName: 'Server Access',
            requesterName: 'Dev User',
            reviewerName: 'IT Manager',
            priority: 'Critical',
            reviewNotes: 'Valid request'
        };
        const rendered = templates.pendingApproval(data);

        assert.strictEqual(rendered.subject, '[IT-Hub] Approval Required: Server Access');
        assert.ok(rendered.html.includes('Dev User'));
        assert.ok(rendered.html.includes('Valid request'));
        assert.ok(rendered.html.includes('/requests/req-456/approve'));
    });

    it('should generate requestApproved template', () => {
        const data = {
            itemName: 'Keyboard',
            approverName: 'Head of IT',
            approvedAt: new Date()
        };
        const rendered = templates.requestApproved(data);

        assert.strictEqual(rendered.subject, '[IT-Hub] Request Approved: Keyboard');
        assert.ok(rendered.html.includes('Head of IT'));
        assert.ok(rendered.html.includes('Approved'));
    });

    it('should generate requestRejected template', () => {
        const data = {
            itemName: 'Gaming Mouse',
            reviewerName: 'IT Admin',
            rejectionReason: 'Not business related'
        };
        const rendered = templates.requestRejected(data);

        assert.strictEqual(rendered.subject, '[IT-Hub] Request Not Approved: Gaming Mouse');
        assert.ok(rendered.html.includes('Not business related'));
        assert.ok(rendered.html.includes('Rejected'));
    });
});
