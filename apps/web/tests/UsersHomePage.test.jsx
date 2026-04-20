import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../src/shared/context/ThemeProvider';

const workspaceSession = vi.hoisted(() => {
    let user = null;

    return {
        getUser: () => user,
        setUser: (nextUser) => {
            user = nextUser;
        }
    };
});

vi.mock('../src/features/users/auth-api', () => ({
    fetchSession: vi.fn(),
    logout: vi.fn()
}));

vi.mock('../src/features/notifications/components/NotificationBell', () => ({
    NotificationBell: () => <div data-testid="notification-bell" />
}));

vi.mock('../src/shared/workspace/WorkspaceLayout', async () => {
    const { Outlet } = await import('react-router-dom');

    return {
        WorkspaceLayout: () => <Outlet context={{ user: workspaceSession.getUser() }} />
    };
});

vi.mock('../src/features/users/home-page.jsx', () => ({
    default: () => <div>Dashboard Content</div>
}));

vi.mock('../src/features/users/users-api.js', () => ({
    fetchUsers: vi.fn()
}));

vi.mock('../src/features/credentials/hooks/useCredentials.js', () => ({
    useLockedCredentials: vi.fn()
}));

vi.mock('../src/features/notifications/hooks/useNotifications.js', () => ({
    useNotifications: vi.fn(() => ({
        notifications: [],
        unreadCount: 0,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn()
    }))
}));

vi.mock('../src/features/exports/components/BatchCredentialExportButton.jsx', () => ({
    BatchCredentialExportButton: () => <button type="button">Export</button>
}));

vi.mock('../src/features/users/ldap-sync-panel.jsx', () => ({
    default: () => <div>LDAP Sync Panel Stub</div>
}));

vi.mock('../src/features/users/users-list-page.jsx', () => ({
    default: () => <div>Directory Content</div>
}));

vi.mock('../src/features/credentials/components/LockedCredentialsList.jsx', () => ({
    default: () => <div>Locked Credentials Content</div>
}));

vi.mock('../src/features/credentials/history', () => ({
    CredentialHistory: () => <div>History Content</div>
}));

import { fetchSession } from '../src/features/users/auth-api';
import { fetchUsers } from '../src/features/users/users-api.js';
import { useLockedCredentials } from '../src/features/credentials/hooks/useCredentials.js';
import { router as appRouter } from '../src/routes/router.jsx';

const adminUser = {
    id: 'user-1',
    username: 'alice.it',
    role: 'admin',
    status: 'active'
};

const renderApp = ({ initialEntry = '/users', user = adminUser } = {}) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 }
        }
    });

    workspaceSession.setUser(user);

    const router = createMemoryRouter(appRouter.routes, {
        initialEntries: [initialEntry]
    });

    render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <RouterProvider router={router} />
            </ThemeProvider>
        </QueryClientProvider>
    );

    return { router };
};

describe('Users module overview route', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        fetchSession.mockResolvedValue({
            user: adminUser
        });

        fetchUsers.mockResolvedValue({
            users: [
                {
                    id: 'user-1',
                    username: 'jane.doe',
                    role: 'requester',
                    status: 'active',
                    ldapFields: { mail: 'jane@example.com', department: 'Finance' }
                }
            ],
            fields: ['mail', 'department'],
            meta: { total: 1 }
        });

        useLockedCredentials.mockReturnValue({
            data: {
                data: [{ userId: 'user-1', systemId: 'imap' }]
            },
            isLoading: false,
            error: null
        });
    });

    it('opens /users on a module landing page with shared module tabs', async () => {
        renderApp();

        expect(await screen.findByRole('heading', { name: 'Users & Credentials' })).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Users and credentials sections' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: 'Directory' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Locked Credentials' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'User Directory' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Recent Access Actions' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Password Generation' })).toBeInTheDocument();
        expect(screen.getAllByRole('heading', { name: 'Locked Credentials' }).length).toBeGreaterThanOrEqual(1);
        expect(document.querySelector('.users-subnav')).not.toBeInTheDocument();
    });

    it('keeps directory active inside shared module tabs', async () => {
        renderApp({ initialEntry: '/users/directory' });

        expect(await screen.findByText('Directory Content')).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Users and credentials sections' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Directory' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: 'Locked Credentials' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument();
    });

    it.each([
        ['it'],
        ['head_it']
    ])('allows %s users to open the users module', async (role) => {
        fetchSession.mockResolvedValue({
            user: {
                id: `user-${role}`,
                username: `${role}.user`,
                role,
                status: 'active'
            }
        });

        renderApp({
            user: {
                id: `user-${role}`,
                username: `${role}.user`,
                role,
                status: 'active'
            }
        });

        expect(await screen.findByRole('heading', { name: 'Users & Credentials' })).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Users and credentials sections' })).toBeInTheDocument();
    });

    it('redirects unauthorized users to / and does not render the users module shell', async () => {
        fetchSession.mockResolvedValue({
            user: {
                id: 'user-2',
                username: 'riley.requester',
                role: 'requester',
                status: 'active'
            }
        });

        const { router } = renderApp({
            user: {
                id: 'user-2',
                username: 'riley.requester',
                role: 'requester',
                status: 'active'
            }
        });

        expect(await screen.findByText('Dashboard Content')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/');
        expect(screen.queryByRole('heading', { name: 'Users & Credentials' })).not.toBeInTheDocument();
    });
});
