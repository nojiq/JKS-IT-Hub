import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../src/shared/context/ThemeProvider';
import { WorkspaceLayout } from '../src/shared/workspace/WorkspaceLayout';
import { UsersLayout } from '../src/features/users/UsersLayout.jsx';
import ImapGeneratorPage from '../src/features/credentials/imap/ImapGeneratorPage.jsx';

vi.mock('../src/features/users/auth-api', () => ({
    fetchSession: vi.fn(),
    logout: vi.fn()
}));

vi.mock('../src/features/notifications/components/NotificationBell', () => ({
    NotificationBell: () => <div data-testid="notification-bell" />
}));

import { fetchSession } from '../src/features/users/auth-api';

const renderApp = (initialEntry = '/users/imap-generator') => {
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
                        { index: true, element: <div>Users Overview</div> },
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

describe('ImapGeneratorPage', () => {
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
    });

    it('renders the IMAP generator route inside the users module shell', async () => {
        renderApp();

        expect(await screen.findByRole('heading', { name: 'Users & Credentials' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'IMAP Generator' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'IMAP Generator' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'User Resolver' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Live Preview' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save IMAP Password' })).toBeInTheDocument();
    });
});
