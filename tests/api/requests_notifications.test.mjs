
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../apps/api/src/shared/db/prisma.js';
import * as requestService from '../../apps/api/src/features/requests/service.js';
import { __setTransporter } from '../../apps/api/src/features/notifications/email/emailService.js';

describe('Requests Notifications Integration', () => {
    let requester;
    let itStaff;
    let adminStaff;
    let mockTransporter;

    beforeEach(async () => {
        // Mock email transporter
        mockTransporter = {
            sendMail: mock.fn(async () => ({ messageId: 'test-msg-id', response: '250 OK' }))
        };
        __setTransporter(mockTransporter);

        // Cleanup
        await prisma.emailNotification.deleteMany();
        await prisma.itemRequest.deleteMany();
        await prisma.user.deleteMany({ where: { username: { in: ['requester_notif', 'it_notif', 'admin_notif', 'requester_notif2'] } } });

        // Create users
        requester = await prisma.user.create({
            data: { username: 'requester_notif', role: 'requester', status: 'active', ldapAttributes: { mail: 'req@example.com' } }
        });
        itStaff = await prisma.user.create({
            data: { username: 'it_notif', role: 'it', status: 'active', ldapAttributes: { mail: 'it@example.com' } }
        });
        adminStaff = await prisma.user.create({
            data: { username: 'admin_notif', role: 'admin', status: 'active', ldapAttributes: { mail: 'admin@example.com' } }
        });
    });

    afterEach(async () => {
        __setTransporter(null);
        mock.restoreAll();

        await prisma.emailNotification.deleteMany();
        await prisma.itemRequest.deleteMany();
        await prisma.user.deleteMany({ where: { username: { in: ['requester_notif', 'it_notif', 'admin_notif', 'requester_notif2'] } } });
    });

    it('should create notification for IT staff when request is submitted', async () => {
        const reqData = { itemName: 'Test Notify Item', description: 'Desc', priority: 'MEDIUM', justification: 'Justification' };

        const request = await requestService.submitRequest(reqData, requester);

        await new Promise(r => setTimeout(r, 50));

        const notifications = await prisma.emailNotification.findMany({
            where: { referenceId: request.id, templateType: 'new_request_submitted' }
        });

        assert.ok(notifications.length > 0, 'Should have created notification');
        const itNotification = notifications.find(n => n.recipientEmail.includes('it@example.com'));
        assert.ok(itNotification, 'Should notify IT staff');
        assert.ok(itNotification.subject.includes('New Item Request'), 'Subject should match template');
    });

    it('should notify requester and admins when IT review is completed', async () => {
        const reqData = { itemName: 'Review Notify Item', description: 'Desc', priority: 'MEDIUM', justification: 'Justification' };
        let request = await requestService.submitRequest(reqData, requester);

        await new Promise(r => setTimeout(r, 50));

        await prisma.emailNotification.deleteMany({ where: { referenceId: request.id } });

        request = await requestService.itReviewRequest(request.id, { itReview: 'Looks good' }, itStaff);

        await new Promise(r => setTimeout(r, 50));

        const requesterNotif = await prisma.emailNotification.findFirst({
            where: {
                referenceId: request.id,
                recipientUserId: requester.id,
                templateType: 'request_reviewed'
            }
        });
        assert.ok(requesterNotif, 'Should notify requester of review');
        assert.ok(requesterNotif.subject.includes('IT Reviewed'), 'Subject should indicate review status');

        const adminNotif = await prisma.emailNotification.findFirst({
            where: {
                referenceId: request.id,
                recipientEmail: { contains: 'admin@example.com' },
                templateType: 'pending_approval'
            }
        });
        assert.ok(adminNotif, 'Should notify admin for pending approval');
    });

    it('should notify requester when request is approved', async () => {
        const reqData = { itemName: 'Approve Notify Item', description: 'Desc', priority: 'MEDIUM', justification: 'Justification' };
        let request = await requestService.submitRequest(reqData, requester);
        request = await requestService.itReviewRequest(request.id, { itReview: 'OK' }, itStaff);

        await new Promise(r => setTimeout(r, 50));
        await prisma.emailNotification.deleteMany({ where: { referenceId: request.id } });

        request = await requestService.approveRequest(request.id, adminStaff);

        await new Promise(r => setTimeout(r, 50));

        const approvedNotif = await prisma.emailNotification.findFirst({
            where: {
                referenceId: request.id,
                recipientUserId: requester.id,
                templateType: 'request_approved'
            }
        });

        assert.ok(approvedNotif, 'Should notify requester of approval');
        assert.ok(approvedNotif.subject.includes('Approved'), 'Subject should indicate approval');
    });

    it('should notify requester when request is rejected', async () => {
        const reqData = { itemName: 'Reject Notify Item', description: 'Desc', priority: 'MEDIUM', justification: 'Justification' };
        let request = await requestService.submitRequest(reqData, requester);

        await new Promise(r => setTimeout(r, 50));
        await prisma.emailNotification.deleteMany({ where: { referenceId: request.id } });

        request = await requestService.rejectRequest(request.id, 'No budget', itStaff);

        await new Promise(r => setTimeout(r, 50));

        const rejectedNotif = await prisma.emailNotification.findFirst({
            where: {
                referenceId: request.id,
                recipientUserId: requester.id,
                templateType: 'request_reviewed' // Maps to request reviewed with rejected status
            }
        });

        assert.ok(rejectedNotif, 'Should notify requester of rejection');
        assert.ok(rejectedNotif.subject.includes('Request Update'), 'Subject should match review update');
        assert.ok(rejectedNotif.subject.includes('Rejected'), 'Subject should include status');
    });

    it('should NOT fail request submission if notification fails', async () => {
        mockTransporter.sendMail = mock.fn(async () => {
            throw new Error("SMTP Error");
        });

        const reqData = { itemName: 'Fail Notify Item', description: 'Desc', priority: 'MEDIUM', justification: 'Justification' };

        try {
            const start = Date.now();
            const request = await requestService.submitRequest(reqData, requester);
            const duration = Date.now() - start;

            assert.ok(request.id, 'Request should be created');
            assert.ok(duration < 1000, 'Should not block response (took ' + duration + 'ms)');

        } catch (e) {
            assert.fail('Should not throw error: ' + e.message);
        }
    });
});
