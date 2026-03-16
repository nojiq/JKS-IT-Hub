import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/shared/utils/api-client.js', () => ({
    apiFetch: vi.fn()
}));

describe('maintenanceApi cycle config contract', () => {
    let apiFetch;
    let fetchCycles;

    beforeEach(async () => {
        vi.resetModules();
        ({ apiFetch } = await import('../src/shared/utils/api-client.js'));
        ({ fetchCycles } = await import('../src/features/maintenance/api/maintenanceApi.js'));
    });

    it('normalizes backend cycle config payload into frontend contract shape', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                data: [
                    {
                        id: 'cycle-1',
                        name: 'Quarterly PM',
                        description: 'Backend value',
                        intervalMonths: 3,
                        isActive: true,
                        defaultChecklistTemplateId: 'template-1',
                        defaultChecklist: {
                            id: 'template-1',
                            name: 'Quarterly Checklist',
                            version: 2,
                            _count: { items: 12 }
                        },
                        createdAt: '2026-02-11T00:00:00.000Z',
                        updatedAt: '2026-02-11T00:00:00.000Z'
                    }
                ],
                meta: {
                    contract: 'maintenance-cycle-config.v1'
                }
            })
        });

        const result = await fetchCycles(false);

        expect(apiFetch).toHaveBeenCalledWith('/api/v1/maintenance/cycles?includeInactive=false');
        expect(result).toEqual([
            {
                id: 'cycle-1',
                name: 'Quarterly PM',
                description: 'Backend value',
                intervalMonths: 3,
                isActive: true,
                defaultChecklistTemplateId: 'template-1',
                defaultChecklist: {
                    id: 'template-1',
                    name: 'Quarterly Checklist',
                    version: 2,
                    itemCount: 12
                },
                createdAt: '2026-02-11T00:00:00.000Z',
                updatedAt: '2026-02-11T00:00:00.000Z'
            }
        ]);
    });

    it('throws structured API error when maintenance cycle request fails', async () => {
        apiFetch.mockResolvedValue({
            ok: false,
            json: async () => ({
                status: 403,
                type: '/problems/maintenance/forbidden',
                detail: 'Unauthorized'
            })
        });

        await expect(fetchCycles(false)).rejects.toThrow('Unauthorized');
    });
});
