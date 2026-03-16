import { test } from 'node:test';
import assert from 'node:assert';
import { templates as emailTemplates } from '../../apps/api/src/features/notifications/email/maintenanceTemplates.js';
import { notificationTemplates as inAppTemplates } from '../../apps/api/src/features/notifications/inApp/maintenanceNotifications.js';

test('Maintenance Notification Templates', async (t) => {

    await t.test('Email: Upcoming Maintenance', () => {
        const data = {
            windowId: '123',
            cycleName: 'Quarterly Patching',
            scheduledDate: new Date('2026-03-01').toISOString(),
            daysUntilDue: 5,
            assignedTechnicians: ['tech1', 'tech2'],
            deviceTypes: ['Server', 'Laptop']
        };

        const result = emailTemplates.upcomingMaintenance(data);

        assert.ok(result.subject.includes('Upcoming Maintenance'));
        assert.ok(result.subject.includes('Quarterly Patching'));
        assert.ok(result.html.includes('Due in 5 days'));
        assert.ok(result.html.includes('tech1, tech2'));
        assert.ok(result.html.includes('Server, Laptop'));
        assert.ok(result.text.includes('Due in 5 days'));
    });

    await t.test('Email: Overdue Maintenance', () => {
        const data = {
            windowId: '123',
            cycleName: 'Monthly Backup',
            scheduledDate: new Date('2026-02-01').toISOString(),
            daysOverdue: 2,
            assignedTechnicians: ['tech1'],
            isEscalation: true
        };

        const result = emailTemplates.overdueMaintenance(data);

        assert.ok(result.subject.includes('OVERDUE Maintenance'));
        assert.ok(result.html.includes('OVERDUE by 2 days'));
        assert.ok(result.html.includes('escalation'));
        assert.ok(result.text.includes('escalation'));
    });

    await t.test('In-App: Upcoming Maintenance', () => {
        const data = {
            windowId: '123',
            cycleName: 'Quarterly Patching',
            scheduledDate: new Date('2026-03-01').toISOString(),
            daysUntilDue: 5
        };

        const result = inAppTemplates.upcomingMaintenance(data);

        assert.strictEqual(result.title, 'Upcoming Maintenance');
        assert.ok(result.message.includes('Quarterly Patching'));
        assert.ok(result.message.includes('5 days'));
        assert.strictEqual(result.type, 'maintenance_upcoming');
        assert.strictEqual(result.referenceId, '123');
    });

    await t.test('In-App: Overdue Maintenance', () => {
        const data = {
            windowId: '123',
            cycleName: 'Monthly Backup',
            scheduledDate: new Date('2026-02-01').toISOString(),
            daysOverdue: 2
        };

        const result = inAppTemplates.overdueMaintenance(data);

        assert.strictEqual(result.title, '⚠️ Overdue Maintenance');
        assert.ok(result.message.includes('2 days overdue'));
        assert.strictEqual(result.type, 'maintenance_overdue');
        assert.strictEqual(result.referenceType, 'maintenance_window');
    });
});
