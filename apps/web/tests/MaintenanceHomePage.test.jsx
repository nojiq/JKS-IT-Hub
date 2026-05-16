import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const workspaceSession = vi.hoisted(() => {
    let user = null;

    return {
        getUser: () => user,
        setUser: (nextUser) => {
            user = nextUser;
        }
    };
});

vi.mock('../src/shared/workspace/WorkspaceLayout', async () => {
    const { Outlet } = await import('react-router-dom');

    return {
        WorkspaceLayout: () => <Outlet context={{ user: workspaceSession.getUser() }} />
    };
});

vi.mock('../src/features/users/home-page.jsx', () => ({
    default: () => <div>Dashboard Content</div>
}));

vi.mock('../src/features/maintenance/pages/MaintenanceAssignmentsPage.jsx', () => ({
    default: () => <div>Assignments View</div>
}));

vi.mock('../src/features/maintenance/pages/MaintenanceHistoryPage.jsx', () => ({
    default: () => <div>History View</div>
}));

vi.mock('../src/features/maintenance/pages/MaintenancePoliciesPage.jsx', () => ({
    default: () => <div>Policies View</div>
}));

vi.mock('../src/features/maintenance/hooks/useMaintenance.js', () => ({
    useMyMaintenanceRuns: vi.fn()
}));

import { useMyMaintenanceRuns } from '../src/features/maintenance/hooks/useMaintenance.js';
import { router as appRouter } from '../src/routes/router.jsx';

const devUser = {
    id: 'user-dev',
    username: 'dev.user',
    role: 'dev',
    status: 'active'
};

const createQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: { retry: false, gcTime: 0 }
    }
});

const renderMaintenanceApp = ({ initialEntry = '/maintenance' } = {}) => {
    workspaceSession.setUser(devUser);

    const router = createMemoryRouter(appRouter.routes, {
        initialEntries: [initialEntry]
    });

    render(
        <QueryClientProvider client={createQueryClient()}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    );
};

describe('Maintenance dashboard route', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        useMyMaintenanceRuns.mockReturnValue({
            data: {
                data: [
                    {
                        id: 'run-1',
                        status: 'overdue',
                        dueDate: '2026-05-10T10:00:00.000Z',
                        asset: { assetTag: 'SRV-ALPHA', name: 'Server Rack Alpha' },
                        profile: { name: '6-Month Major Maintenance' }
                    },
                    {
                        id: 'run-2',
                        status: 'due',
                        dueDate: '2026-05-20T10:00:00.000Z',
                        asset: { assetTag: 'LAP-12', name: 'Laptop 12' },
                        profile: { name: 'Quarterly PM' }
                    }
                ],
                meta: { total: 2 }
            },
            isLoading: false,
            error: null,
            isFetching: false
        });
    });

    it('opens dashboard with metrics and run list', async () => {
        renderMaintenanceApp();

        expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Overdue: 1' })).toBeInTheDocument();
        expect(screen.getByText('6-Month Major Maintenance')).toBeInTheDocument();
        expect(screen.getByText(/Server Rack Alpha/)).toBeInTheDocument();
    });
});
