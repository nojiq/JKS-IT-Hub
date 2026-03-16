import { test, afterEach, after } from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../apps/api/src/shared/db/prisma.js';
import * as inAppRepo from '../../apps/api/src/features/notifications/inAppRepo.js';

// Helper to create a test user
async function createTestUser(username = `test_user_${Date.now()}`) {
    return prisma.user.create({
        data: {
            username,
            status: 'active',
            role: 'requester'
        }
    });
}

// Cleanup function
async function cleanup() {
    await prisma.inAppNotification.deleteMany({});
    await prisma.user.deleteMany({
        where: {
            username: { startsWith: 'test_user_' }
        }
    });
}

// Clean up after each test
afterEach(async () => {
    await cleanup();
});

// Disconnect after all tests
after(async () => {
    await prisma.$disconnect();
});

test('inAppRepo - createNotification creates a notification', async () => {
    const user = await createTestUser();

    const notification = await inAppRepo.createNotification({
        userId: user.id,
        title: 'Test Notification',
        message: 'This is a test message',
        type: 'test_type',
        referenceType: 'item_request',
        referenceId: '123e4567-e89b-12d3-a456-426614174000'
    });

    assert.ok(notification.id, 'Notification should have an ID');
    assert.strictEqual(notification.userId, user.id);
    assert.strictEqual(notification.title, 'Test Notification');
    assert.strictEqual(notification.isRead, false);
});

test('inAppRepo - createBulkNotifications creates multiple notifications', async () => {
    const user1 = await createTestUser(`bulk_user_1_${Date.now()}`);
    const user2 = await createTestUser(`bulk_user_2_${Date.now()}`);

    const notifications = [
        {
            userId: user1.id,
            title: 'Notification 1',
            message: 'Message 1',
            type: 'test_type'
        },
        {
            userId: user2.id,
            title: 'Notification 2',
            message: 'Message 2',
            type: 'test_type'
        }
    ];

    const result = await inAppRepo.createBulkNotifications(notifications);
    assert.strictEqual(result.count, 2, 'Should create 2 notifications');
});

test('inAppRepo - getNotificationsByUserId returns user notifications', async () => {
    const user = await createTestUser();

    // Create 3 notifications
    await inAppRepo.createBulkNotifications([
        { userId: user.id, title: 'N1', message: 'M1', type: 'test' },
        { userId: user.id, title: 'N2', message: 'M2', type: 'test' },
        { userId: user.id, title: 'N3', message: 'M3', type: 'test' }
    ]);

    const result = await inAppRepo.getNotificationsByUserId(user.id, { page: 1, limit: 10 });

    assert.strictEqual(result.data.length, 3);
    assert.strictEqual(result.meta.total, 3);
    assert.strictEqual(result.meta.page, 1);
});

test('inAppRepo - getUnreadCount returns correct count', async () => {
    const user = await createTestUser();

    await inAppRepo.createBulkNotifications([
        { userId: user.id, title: 'N1', message: 'M1', type: 'test' },
        { userId: user.id, title: 'N2', message: 'M2', type: 'test' }
    ]);

    const count = await inAppRepo.getUnreadCount(user.id);
    assert.strictEqual(count, 2);
});

test('inAppRepo - markAsRead marks notification as read', async () => {
    const user = await createTestUser();
    const notification = await inAppRepo.createNotification({
        userId: user.id,
        title: 'Test',
        message: 'Test',
        type: 'test'
    });

    await inAppRepo.markAsRead(notification.id, user.id);

    const updated = await inAppRepo.getNotificationById(notification.id);
    assert.strictEqual(updated.isRead, true);
    assert.ok(updated.readAt);
});

test('inAppRepo - markAllAsRead marks all notifications as read', async () => {
    const user = await createTestUser();

    await inAppRepo.createBulkNotifications([
        { userId: user.id, title: 'N1', message: 'M1', type: 'test' },
        { userId: user.id, title: 'N2', message: 'M2', type: 'test' }
    ]);

    await inAppRepo.markAllAsRead(user.id);

    const count = await inAppRepo.getUnreadCount(user.id);
    assert.strictEqual(count, 0);
});
