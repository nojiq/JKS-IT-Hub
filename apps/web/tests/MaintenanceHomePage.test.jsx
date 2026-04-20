import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaintenanceLayout } from '../src/features/maintenance/pages/MaintenanceLayout.jsx';
import MaintenanceHomePage from '../src/features/maintenance/pages/MaintenanceHomePage.jsx';

vi.mock('../src/features/maintenance/hooks/useMaintenance.js', () => ({
    useWindows: vi.fn(),
    useMyMaintenanceWindows: vi.fn(),
    useMaintenanceHistory: vi.fn()
}));

import {
    useMaintenanceHistory,
    useMyMaintenanceWindows,
    useWindows
} from '../src/features/maintenance/hooks/useMaintenance.js';

const adminUser = {
    id: 'user-1',
    username: 'alice.admin',
    role: 'admin',
    status: 'active'
};

const createQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: { retry: false, gcTime: 0 }
    }
});

const RootOutlet = () => <Outlet context={{ user: adminUser }} />;

const renderMaintenanceApp = (initialEntry = '/maintenance') => {
    const router = createMemoryRouter([
        {
            path: '/',
            element: <RootOutlet />,
            children: [
                {
                    path: 'maintenance',
                    element: <MaintenanceLayout />,
                    children: [
                        { index: true, element: <MaintenanceHomePage /> },
                        { path: 'schedule', element: <div>Schedule View</div> },
                        { path: 'my-tasks', element: <div>My Tasks View</div> },
                        { path: 'history', element: <div>History View</div> },
                        { path: 'config', element: <div>Config View</div> }
                    ]
                }
            ]
        }
    ], {
        initialEntries: [initialEntry]
    });

    return render(
        <QueryClientProvider client={createQueryClient()}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    );
};

describe('Maintenance module overview route', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        useWindows.mockReturnValue({
            data: {
                data: [
                    { id: 'win-1', status: 'UPCOMING', cycleConfig: { name: 'Quarterly PM' } },
                    { id: 'win-2', status: 'OVERDUE', cycleConfig: { name: 'Server Patch Window' } }
                ],
                meta: { total: 2 }
            },
            isLoading: false,
            error: null
        });

        useMyMaintenanceWindows.mockReturnValue({
            data: {
                data: [
                    { id: 'task-1', status: 'UPCOMING', cycleConfig: { name: 'Quarterly PM' } }
                ],
                meta: { total: 1 }
            },
            isLoading: false,
            error: null
        });

        useMaintenanceHistory.mockReturnValue({
            data: {
                data: [{ id: 'history-1' }, { id: 'history-2' }, { id: 'history-3' }],
                meta: { total: 3 }
            },
            isLoading: false,
            error: null
        });
    });

    it('opens /maintenance on an overview page with module-local nav', async () => {
        renderMaintenanceApp('/maintenance');

        expect(await screen.findByRole('heading', { name: 'Maintenance' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Overview' })).toHaveClass('is-active');
        expect(screen.getByRole('link', { name: 'Schedule' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'My Tasks' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Config' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Upcoming Windows' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'My Tasks' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Overdue' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
    });
});
