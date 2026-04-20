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

const renderMaintenanceApp = ({ initialEntry = '/maintenance', user = adminUser } = {}) => {
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
                data: [{ id: 'history-1' }, { id: 'history-2' }, { id: 'history-3' }],
                meta: { total: 3 }
            },
            isLoading: false,
            error: null
        });
    });

    it('opens /maintenance on an overview page with shared module tabs', async () => {
        renderMaintenanceApp();

        expect(await screen.findByRole('heading', { name: 'Maintenance' })).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Maintenance sections' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: 'Schedule' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'My Tasks' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Config' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Rules' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Checklists' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Upcoming Windows' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'My Tasks' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Overdue' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
        expect(document.querySelector('.maintenance-subnav')).not.toBeInTheDocument();
    });

    it('keeps history active inside shared module tabs', async () => {
        renderMaintenanceApp({ initialEntry: '/maintenance/history' });

        expect(await screen.findByText('History View')).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Maintenance sections' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: 'Rules' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Checklists' })).toBeInTheDocument();
    });

    it.each([
        ['it'],
        ['head_it']
    ])('allows %s users to open the maintenance module', async (role) => {
        renderMaintenanceApp({
            user: {
                ...adminUser,
                id: `user-${role}`,
                username: `${role}.user`,
                role
            }
        });

        expect(await screen.findByRole('heading', { name: 'Maintenance' })).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Maintenance sections' })).toBeInTheDocument();
    });

    it('redirects unauthorized users to / and does not render the maintenance shell', async () => {
        const { router } = renderMaintenanceApp({ user: requesterUser });

        expect(await screen.findByText('Dashboard Content')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/');
        expect(screen.queryByRole('heading', { name: 'Maintenance' })).not.toBeInTheDocument();
    });
});
