
import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { formatBatchCredentialExport, exportBatchCredentials } from '../../apps/api/src/features/exports/service.js';
import { prisma } from "../../apps/api/src/features/audit/repo.js";


describe('Batch Credential Export Service', () => {
    describe('formatBatchCredentialExport', () => {
        it('should format batch export with header, user sections, and summary', () => {
            const batchId = 'test-batch-id';
            const exportResults = [
                {
                    user: {
                        id: 'user-1',
                        displayName: 'User One',
                        email: 'user1@example.com'
                    },
                    credentials: [
                        {
                            username: 'u1-sys1',
                            password: 'pass1',
                            systemConfig: { systemId: 'sys1', description: 'System One' }
                        }
                    ]
                }
            ];
            const skippedUsers = [
                { userId: 'user-2', userName: 'User Two', reason: 'Disabled' }
            ];

            const result = formatBatchCredentialExport(batchId, exportResults, skippedUsers);

            assert.ok(result.includes('IT-HUB BATCH CREDENTIAL EXPORT'));
            assert.ok(result.includes(`Batch ID: ${batchId}`));
            assert.ok(result.includes('Total Users: 2'));
            assert.ok(result.includes('Successful Exports: 1'));
            assert.ok(result.includes('Skipped Users: 1'));

            // User 1
            assert.ok(result.includes('USER 1 OF 2'));
            assert.ok(result.includes('User: User One'));
            assert.ok(result.includes('System One'));
            assert.ok(result.includes('Username: u1-sys1'));

            // Skipped User
            assert.ok(result.includes('SKIPPED USERS'));
            assert.ok(result.includes('User: User Two'));
            assert.ok(result.includes('Reason: Disabled'));
        });
    });

    describe('exportBatchCredentials', () => {
        // Setup for integration tests
        it('should export credentials for multiple users', async () => {
            // Create test users
            const user1 = await prisma.user.create({
                data: {
                    username: `batch-user1-${randomUUID()}`,
                    role: 'requester',
                    status: 'active'
                }
            });

            const user2 = await prisma.user.create({
                data: {
                    username: `batch-user2-${randomUUID()}`,
                    role: 'requester',
                    status: 'active'
                }
            });

            // Create system config
            const system = await prisma.systemConfig.create({
                data: {
                    systemId: `sys-${randomUUID()}`,
                    usernameLdapField: 'cn',
                    description: 'Test System'
                }
            });

            // Create credentials
            await prisma.userCredential.create({
                data: {
                    userId: user1.id,
                    systemId: system.systemId,
                    username: 'user1',
                    password: 'password1',
                    templateVersion: 1,
                    generatedBy: user1.id
                }
            });

            const testUsers = [user1.id, user2.id];
            const testActorUserId = user1.id; // Just use user1 as actor

            try {
                // This call should fail initially
                const result = await exportBatchCredentials(testUsers, testActorUserId);

                assert.ok(result.includes('IT-HUB BATCH CREDENTIAL EXPORT'));
                assert.ok(result.includes('Total Users: 2'));
                assert.ok(result.includes('Successful Exports: 1')); // User 1 has creds
                assert.ok(result.includes('Skipped Users: 1')); // User 2 has no creds
                assert.ok(result.includes('User: batch-user1'));
                assert.ok(result.includes('Reason: No exportable credentials')); // For user 2
            } finally {
                // Cleanup
                await prisma.userCredential.deleteMany({ where: { userId: user1.id } });
                await prisma.user.deleteMany({ where: { id: { in: testUsers } } });
                await prisma.systemConfig.deleteMany({ where: { id: system.id } });
            }
        });

        after(async () => {
            await prisma.$disconnect();
        });
    });
});
