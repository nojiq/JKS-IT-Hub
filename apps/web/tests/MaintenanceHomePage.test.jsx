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

vi.mock('../src/features/maintenance/pages/MaintenanceSchedulePage.jsx', () => ({
    default: () => <div>Schedule View</div>
}));

vi.mock('../src/features/maintenance/pages/MaintenanceHistoryPage.jsx', () => ({
    default: () => <div>History View</div>
}));

vi.mock('../src/features/maintenance/pages/MaintenanceConfigPage.jsx', () => ({
    default: () => <div>Config View</div>
}));

vi.mock('../src/features/maintenance/pages/AssignmentRulesPage.jsx', () => ({
    default: () => <div>Rules View</div>
}));

vi.mock('../src/features/maintenance/pages/MyMaintenanceTasksPage.jsx', () => ({
    default: () => <div>My Tasks View</div>
}));

vi.mock('../src/features/maintenance/pages/ChecklistManagementPage.jsx', () => ({
    default: () => <div>Checklists View</div>
}));

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

const renderMaintenanceApp = ({ initialEntry = '/maintenance', user = devUser } = {}) => {
    workspaceSession.setUser(user);

    const router = createMemoryRouter(appRouter.routes, {
        initialEntries: [initialEntry]
    });

    render(
        <QueryClientProvider client={createQueryClient()}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    );

    return { router };
};

const requesterUser = {
    id: 'user-2',
    username: 'riley.requester',
    role: 'requester',
    status: 'active'
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
                data: [
                    { id: 'history-1', window: { id: 'win-h1', status: 'COMPLETED', cycleConfig: { name: 'Quarterly PM' } } },
                    { id: 'history-2', window: { id: 'win-h2', status: 'COMPLETED', cycleConfig: { name: 'Server Patch' } } }
                ],
                meta: { total: 2 }
            },
            isLoading: false,
            error: null
        });
    });

    it('opens /maintenance for developer users with dashboard sections', async () => {
        renderMaintenanceApp();

        expect(await screen.findByRole('heading', { name: 'Maintenance dashboard' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Next maintenance' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'My tasks' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Overdue' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Recent history' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'View schedule' })).toBeInTheDocument();
        expect(screen.getByText('Upcoming')).toBeInTheDocument();
    });

    it('keeps history subroute reachable for developer users', async () => {
        renderMaintenanceApp({ initialEntry: '/maintenance/history' });

        expect(await screen.findByText('History View')).toBeInTheDocument();
    });

    it.each([
        ['it'],
        ['head_it'],
        ['admin']
    ])('redirects %s users away from the maintenance module', async (role) => {
        renderMaintenanceApp({
            user: {
                ...devUser,
                id: `user-${role}`,
                username: `${role}.user`,
                role
            }
        });

        expect(await screen.findByText('Dashboard Content')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Maintenance dashboard' })).not.toBeInTheDocument();
    });

    it('redirects unauthorized users to / and does not render the maintenance shell', async () => {
        const { router } = renderMaintenanceApp({ user: requesterUser });

        expect(await screen.findByText('Dashboard Content')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/');
        expect(screen.queryByRole('heading', { name: 'Maintenance dashboard' })).not.toBeInTheDocument();
    });
});
