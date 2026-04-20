import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../src/shared/context/ThemeProvider';
import { WorkspaceLayout } from '../src/shared/workspace/WorkspaceLayout';
import { UsersLayout } from '../src/features/users/UsersLayout.jsx';
import UsersHomePage from '../src/features/users/UsersHomePage.jsx';
import { default as ImapGeneratorPage } from '../src/features/credentials/imap/ImapGeneratorPage.jsx';

vi.mock('../src/features/users/auth-api', () => ({
    fetchSession: vi.fn(),
    logout: vi.fn()
}));

vi.mock('../src/features/notifications/components/NotificationBell', () => ({
    NotificationBell: () => <div data-testid="notification-bell" />
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

import { fetchSession } from '../src/features/users/auth-api';
import { fetchUsers } from '../src/features/users/users-api.js';
import { useLockedCredentials } from '../src/features/credentials/hooks/useCredentials.js';

const renderApp = (initialEntry = '/users') => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 }
        }
    });

    const router = createMemoryRouter([
        {
            path: '/',
            element: <WorkspaceLayout />,
            children: [
                { index: true, element: <div>Dashboard Content</div> },
                {
                    path: 'users',
                    element: <UsersLayout />,
                    children: [
                        { index: true, element: <UsersHomePage /> },
                        { path: 'directory', element: <div>Directory Content</div> },
                        { path: 'imap-generator', element: <ImapGeneratorPage /> },
                        { path: 'locked', element: <div>Locked Credentials Content</div> },
                        { path: 'history', element: <div>History Content</div> }
                    ]
                }
            ]
        }
    ], {
        initialEntries: [initialEntry]
    });

    render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <RouterProvider router={router} />
            </ThemeProvider>
        </QueryClientProvider>
    );
};

describe('Users module overview route', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        fetchSession.mockResolvedValue({
            user: {
                id: 'user-1',
                username: 'alice.it',
                role: 'admin',
                status: 'active'
            }
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

    it('opens /users on a module landing page with local navigation', async () => {
        renderApp('/users');

        expect(await screen.findByRole('heading', { name: 'Users & Credentials' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Directory' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'IMAP Generator' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Locked Credentials' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'User Directory' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Recent Access Actions' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Password Generation' })).toBeInTheDocument();
        expect(screen.getAllByRole('heading', { name: 'Locked Credentials' }).length).toBeGreaterThanOrEqual(1);
    });
});
