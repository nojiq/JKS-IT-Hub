
import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../apps/api/src/shared/db/prisma.js';

describe('Credential Lock Schema', () => {
    it('should have LockedCredential model in prisma client', () => {
        assert.ok(prisma.lockedCredential, 'prisma.lockedCredential should be defined');
    });
});
