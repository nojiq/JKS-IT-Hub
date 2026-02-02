import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the api-client
vi.mock('../../apps/web/src/shared/utils/api-client.js', () => ({
    apiFetch: vi.fn()
}));

describe('Audit API Client', () => {
    let apiFetch;
    let fetchAuditLogs;

    beforeEach(async () => {
        vi.resetModules();
        const apiClient = await import('../../apps/web/src/shared/utils/api-client.js');
        apiFetch = apiClient.apiFetch;

        const auditApi = await import('../../apps/web/src/features/audit/audit-api.js');
        fetchAuditLogs = auditApi.fetchAuditLogs;
    });

    describe('fetchAuditLogs', () => {
        it('should fetch audit logs with default pagination', async () => {
            const mockData = {
                data: [
                    {
                        id: '1',
                        action: 'user.status_change',
                        actor: { username: 'admin', role: 'admin' },
                        target: 'user:123',
                        metadata: { from: 'active', to: 'disabled' },
                        createdAt: '2026-01-30T00:00:00Z'
                    }
                ],
                meta: { total: 1, page: 1, limit: 20 }
            };

            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => mockData
            });

            const result = await fetchAuditLogs();

            expect(apiFetch).toHaveBeenCalledWith('/audit-logs?page=1&limit=20');
            expect(result).toEqual(mockData);
        });

        it('should fetch audit logs with custom pagination', async () => {
            const mockData = {
                data: [],
                meta: { total: 0, page: 2, limit: 10 }
            };

            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => mockData
            });

            const result = await fetchAuditLogs({ page: 2, limit: 10 });

            expect(apiFetch).toHaveBeenCalledWith('/audit-logs?page=2&limit=10');
            expect(result).toEqual(mockData);
        });

        it('should fetch audit logs with filters', async () => {
            const mockData = {
                data: [],
                meta: { total: 0, page: 1, limit: 20 }
            };

            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => mockData
            });

            const filters = {
                action: 'user.status_change',
                actorId: '123',
                startDate: '2026-01-01T00:00:00Z',
                endDate: '2026-01-31T23:59:59Z'
            };

            const result = await fetchAuditLogs({ page: 1, limit: 20, ...filters });

            expect(apiFetch).toHaveBeenCalledWith(
                '/audit-logs?page=1&limit=20&action=user.status_change&actorId=123&startDate=2026-01-01T00%3A00%3A00Z&endDate=2026-01-31T23%3A59%3A59Z'
            );
            expect(result).toEqual(mockData);
        });

        it('should handle API errors', async () => {
            apiFetch.mockResolvedValue({
                ok: false,
                json: async () => ({ detail: 'Unauthorized' })
            });

            await expect(fetchAuditLogs()).rejects.toThrow('Unauthorized');
        });

        it('should handle network errors', async () => {
            apiFetch.mockResolvedValue({
                ok: false,
                json: async () => {
                    throw new Error('Network error');
                }
            });

            await expect(fetchAuditLogs()).rejects.toThrow('Request failed.');
        });
    });
});
