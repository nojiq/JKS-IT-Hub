import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MaintenanceConfigPage from '../src/features/maintenance/pages/MaintenanceConfigPage.jsx';
import { useMaintenanceConfig, useGenerateSchedule } from '../src/features/maintenance/hooks/useMaintenance.js';

vi.mock('../src/features/maintenance/hooks/useMaintenance.js', () => ({
    maintenanceConfigViewStates: {
        loading: 'loading',
        empty: 'empty',
        success: 'success',
        error: 'error'
    },
    useMaintenanceConfig: vi.fn(),
    useGenerateSchedule: vi.fn()
}));

vi.mock('../src/shared/hooks/useToast.js', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn()
    })
}));

const renderPage = () => {
    render(
        <MemoryRouter>
            <MaintenanceConfigPage />
        </MemoryRouter>
    );
};

describe('MaintenanceConfigPage linkage states', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useGenerateSchedule.mockReturnValue({
            mutateAsync: vi.fn(),
            isPending: false
        });
    });

    it('renders explicit loading state', () => {
        useMaintenanceConfig.mockReturnValue({
            cycles: [],
            viewState: 'loading',
            error: null
        });

        renderPage();

        expect(screen.getByTestId('maintenance-config-loading')).toBeInTheDocument();
    });

    it('renders backend-linked cycle values in success state', () => {
        useMaintenanceConfig.mockReturnValue({
            cycles: [
                {
                    id: 'cycle-1',
                    name: 'Quarterly PM',
                    description: 'Quarterly preventive maintenance',
                    intervalMonths: 3,
                    isActive: true,
                    defaultChecklistTemplateId: null,
                    defaultChecklist: null,
                    createdAt: '2026-02-11T00:00:00.000Z',
                    updatedAt: '2026-02-11T00:00:00.000Z'
                }
            ],
            viewState: 'success',
            error: null
        });

        renderPage();

        expect(screen.getByText('Maintenance Cycles Configuration')).toBeInTheDocument();
        expect(screen.getByText('Quarterly PM')).toBeInTheDocument();
        expect(screen.getByText('Quarterly preventive maintenance')).toBeInTheDocument();
        expect(screen.queryByTestId('maintenance-config-empty')).not.toBeInTheDocument();
    });

    it('renders explicit empty state when backend returns no cycle configs', () => {
        useMaintenanceConfig.mockReturnValue({
            cycles: [],
            viewState: 'empty',
            error: null
        });

        renderPage();

        expect(screen.getByTestId('maintenance-config-empty')).toBeInTheDocument();
        expect(screen.queryByText('Quarterly PM')).not.toBeInTheDocument();
    });

    it('renders error state and surfaces backend failure detail', () => {
        useMaintenanceConfig.mockReturnValue({
            cycles: [],
            viewState: 'error',
            error: new Error('Maintenance API unavailable')
        });

        renderPage();

        expect(screen.getByRole('alert')).toHaveTextContent('Maintenance API unavailable');
        expect(screen.getByTestId('maintenance-config-error')).toBeInTheDocument();
    });
});
