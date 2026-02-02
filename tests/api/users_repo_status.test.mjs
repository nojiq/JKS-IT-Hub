
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createUser, updateUserStatus, findUserById, prisma } from '../../apps/api/src/features/users/repo.js';

describe('User Repository - Status Management', () => {
    let userId;

    before(async () => {
        // Clean up potentially existing user
        await prisma.user.deleteMany({ where: { username: { startsWith: 'repo-status-test' } } });

        // Create a test user
        const user = await createUser({
            username: 'repo-status-test',
            role: 'requester',
            status: 'active'
        });
        userId = user.id;
    });

    after(async () => {
        await prisma.user.deleteMany({ where: { username: { startsWith: 'repo-status-test' } } });
        // Do NOT disconnect prisma here if it's shared from repo.js!
        // repo.js prisma instance is likely reused.
        // But for tests, we might want to close it?
        // Since we imported it, maybe we shouldn't close it explicitly if other tests run.
        // However, node test runner usually runs in isolation per file?
        // Yes, `node --test file.mjs` runs isolated.
        await prisma.$disconnect();
    });

    test('updateUserStatus should update user status to disabled', async () => {
        const updated = await updateUserStatus(userId, 'disabled');

        assert.equal(updated.status, 'disabled');
        assert.equal(updated.id, userId);

        // Verify persistence
        const fresh = await findUserById(userId);
        assert.equal(fresh.status, 'disabled');
    });

    test('updateUserStatus should update user status back to active', async () => {
        const updated = await updateUserStatus(userId, 'active');

        assert.equal(updated.status, 'active');

        const fresh = await findUserById(userId);
        assert.equal(fresh.status, 'active');
    });
});
