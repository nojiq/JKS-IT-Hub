import { test } from 'node:test';
import assert from 'node:assert';

test('Maintenance Notification Service Exists', async () => {
    try {
        await import('../../apps/api/src/features/notifications/maintenanceNotifications.js');
        assert.ok(true, 'Service should load');
    } catch (e) {
        assert.fail(`Failed to load service: ${e.message}`);
    }
});
