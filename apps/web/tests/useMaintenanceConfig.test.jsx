import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as maintenanceApi from '../src/features/maintenance/api/maintenanceApi.js';
import { maintenanceConfigViewStates, useMaintenanceConfig } from '../src/features/maintenance/hooks/useMaintenance.js';

vi.mock('../src/features/maintenance/api/maintenanceApi.js', async () => {
    const actual = await vi.importActual('../src/features/maintenance/api/maintenanceApi.js');
    return {
        ...actual,
        fetchCycles: vi.fn()
    };
});

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            }
        }
    });

    return ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

describe('useMaintenanceConfig', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns loading view state while cycle config request is in-flight', () => {
        maintenanceApi.fetchCycles.mockImplementation(() => new Promise(() => {}));

        const { result } = renderHook(() => useMaintenanceConfig(false), {
            wrapper: createWrapper()
        });

        expect(result.current.viewState).toBe(maintenanceConfigViewStates.loading);
        expect(result.current.cycles).toEqual([]);
    });

    it('returns success state with backend-linked cycle values', async () => {
        maintenanceApi.fetchCycles.mockResolvedValue([
            {
                id: 'cycle-1',
                name: 'Quarterly PM',
                description: 'Production systems',
                intervalMonths: 3,
                isActive: true,
                defaultChecklistTemplateId: null,
                defaultChecklist: null,
                createdAt: '2026-02-11T00:00:00.000Z',
                updatedAt: '2026-02-11T00:00:00.000Z'
            }
        ]);

        const { result } = renderHook(() => useMaintenanceConfig(false), {
            wrapper: createWrapper()
        });

        await waitFor(() => {
            expect(result.current.viewState).toBe(maintenanceConfigViewStates.success);
        });

        expect(result.current.cycles).toHaveLength(1);
        expect(result.current.cycles[0].name).toBe('Quarterly PM');
        expect(result.current.cycles[0].intervalMonths).toBe(3);
    });

    it('returns empty state when backend has no cycle configuration records', async () => {
        maintenanceApi.fetchCycles.mockResolvedValue([]);

        const { result } = renderHook(() => useMaintenanceConfig(false), {
            wrapper: createWrapper()
        });

        await waitFor(() => {
            expect(result.current.viewState).toBe(maintenanceConfigViewStates.empty);
        });

        expect(result.current.cycles).toEqual([]);
    });

    it('returns error state and clears stale cycles on backend failure', async () => {
        maintenanceApi.fetchCycles.mockRejectedValue(new Error('Maintenance API unavailable'));

        const { result } = renderHook(() => useMaintenanceConfig(false), {
            wrapper: createWrapper()
        });

        await waitFor(() => {
            expect(result.current.viewState).toBe(maintenanceConfigViewStates.error);
        });

        expect(result.current.error).toBeTruthy();
        expect(result.current.cycles).toEqual([]);
    });
});
