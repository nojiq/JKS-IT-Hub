import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../src/shared/context/ThemeProvider';
import { WorkspaceLayout } from '../src/shared/workspace/WorkspaceLayout';

vi.mock('../src/features/users/auth-api', () => ({
    fetchSession: vi.fn(),
    logout: vi.fn()
}));

vi.mock('../src/features/notifications/components/NotificationBell', () => ({
    NotificationBell: () => <div data-testid="notification-bell" />
}));

import { fetchSession } from '../src/features/users/auth-api';

const renderWorkspace = (initialEntry = '/') => {
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
                { path: 'users', element: <div>Users Content</div> }
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

    return router;
};

describe('WorkspaceLayout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchSession.mockResolvedValue({
            user: {
                id: 'user-1',
                username: 'alice.it',
                role: 'it',
                status: 'active'
            }
        });
    });

    it('keeps shell context while route content changes', async () => {
        const router = renderWorkspace('/');

        expect(await screen.findByText('Dashboard Content')).toBeInTheDocument();

        const sidebar = screen.getByLabelText('Workspace sections');
        const topbarSearch = screen.getByLabelText('Search users');

        await act(async () => {
            await router.navigate('/users');
        });

        expect(await screen.findByText('Users Content')).toBeInTheDocument();
        expect(screen.getByLabelText('Workspace sections')).toBe(sidebar);
        expect(screen.getByLabelText('Search users')).toBe(topbarSearch);
        expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    });

    it('renders onboarding child links in the sidebar only while inside onboarding routes', async () => {
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
                        path: 'onboarding',
                        element: <div>Onboarding Shell</div>,
                        children: [
                            { path: 'catalog', element: <div>Catalog Content</div> },
                            { path: 'defaults', element: <div>Defaults Content</div> },
                            { path: 'new-joiner', element: <div>New Joiner Content</div> }
                        ]
                    }
                ]
            }
        ], {
            initialEntries: ['/']
        });

        render(
            <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                    <RouterProvider router={router} />
                </ThemeProvider>
            </QueryClientProvider>
        );

        expect(await screen.findByText('Dashboard Content')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Catalog' })).not.toBeInTheDocument();

        await act(async () => {
            await router.navigate('/onboarding/new-joiner');
        });

        expect(await screen.findByRole('link', { name: 'Catalog' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Defaults' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'New Joiner' })).toBeInTheDocument();
    });
});
