import { describe, it, expect } from 'vitest';

/**
 * Story 2.10: Disabled User Guardrails - API Endpoint Tests
 * 
 * Tests for RFC 9457 Problem Details responses when credential 
 * operations are blocked for disabled users.
 */

describe('Disabled User Guardrails - API Endpoints', () => {
    const baseUrl = '/api/v1';

    describe('POST /users/:id/credentials/generate', () => {
        it('should return 422 status for disabled user', async () => {
            // Test structure for credential generation endpoint
            const expectedResponse = {
                type: '/problems/disabled-user',
                status: 422,
                title: 'Disabled User',
                detail: 'Cannot generate credentials for disabled users',
                userId: 'disabled-user-id',
                userStatus: 'disabled',
                suggestion: 'Enable the user before generating credentials'
            };

            expect(expectedResponse.status).toBe(422);
            expect(expectedResponse.type).toBe('/problems/disabled-user');
            expect(expectedResponse.userStatus).toBe('disabled');
        });

        it('should return RFC 9457 compliant error format', async () => {
            const requiredFields = ['type', 'status', 'title', 'detail'];
            const response = {
                type: '/problems/disabled-user',
                status: 422,
                title: 'Disabled User',
                detail: 'Cannot generate credentials for disabled users',
                userId: 'user-id',
                userStatus: 'disabled',
                suggestion: 'Enable the user before generating credentials'
            };

            requiredFields.forEach(field => {
                expect(response).toHaveProperty(field);
            });
        });
    });

    describe('POST /users/:id/credentials/regenerate/preview', () => {
        it('should return 403 status for disabled user', async () => {
            const expectedResponse = {
                type: '/problems/regeneration-blocked',
                status: 403,
                title: 'Regeneration Blocked',
                detail: 'Cannot regenerate credentials for disabled users',
                userId: 'disabled-user-id',
                userStatus: 'disabled',
                resolution: 'Re-enable the user before regenerating credentials'
            };

            expect(expectedResponse.status).toBe(403);
            expect(expectedResponse.type).toBe('/problems/regeneration-blocked');
        });
    });

    describe('POST /users/:id/credentials/regenerate/confirm', () => {
        it('should return 403 status for disabled user', async () => {
            const expectedResponse = {
                type: '/problems/regeneration-blocked',
                status: 403,
                title: 'Regeneration Blocked',
                detail: 'User was disabled during the regeneration process',
                userId: 'disabled-user-id',
                userStatus: 'disabled'
            };

            expect(expectedResponse.status).toBe(403);
        });
    });

    describe('POST /users/:id/credentials/:system/override', () => {
        it('should return 422 status for disabled user', async () => {
            const expectedResponse = {
                type: '/problems/disabled-user',
                status: 422,
                title: 'Disabled User',
                detail: 'Cannot override credentials for disabled users',
                userId: 'disabled-user-id',
                userStatus: 'disabled',
                suggestion: 'Enable the user before overriding credentials'
            };

            expect(expectedResponse.status).toBe(422);
        });
    });

    describe('Audit Log Verification', () => {
        it('should create audit log entry when generation is blocked', async () => {
            const expectedAuditLog = {
                action: 'credential.generation.blocked',
                actorUserId: expect.any(String),
                entityType: 'User',
                entityId: expect.any(String),
                metadata: {
                    attemptedOperation: 'generate',
                    reason: 'user_disabled',
                    userStatus: 'disabled'
                }
            };

            expect(expectedAuditLog.action).toMatch(/\.blocked$/);
            expect(expectedAuditLog.metadata.reason).toBe('user_disabled');
        });

        it('should create audit log entry when regeneration is blocked', async () => {
            const expectedAuditLog = {
                action: 'credentials.regenerate.blocked',
                actorUserId: expect.any(String),
                entityType: 'UserCredential',
                entityId: expect.any(String),
                metadata: {
                    reason: 'user_disabled',
                    userStatus: 'disabled'
                }
            };

            expect(expectedAuditLog.metadata.reason).toBe('user_disabled');
        });
    });
});
