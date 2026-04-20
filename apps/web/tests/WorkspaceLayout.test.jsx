import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

const createMatchMedia = ({ isMobile = false, isTablet = false, isDesktop = true } = {}) =>
    vi.fn().mockImplementation((query) => {
        let matches = false;
        if (query === '(max-width: 767px)') {
            matches = isMobile;
        } else if (query === '(min-width: 768px) and (max-width: 1023px)') {
            matches = isTablet;
        } else if (query === '(min-width: 1024px)') {
            matches = isDesktop;
        }

        return {
            matches,
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn()
        };
    });

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
        window.matchMedia = createMatchMedia();
        window.localStorage.clear();
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
        expect(screen.getByText('IT Hub')).toBeInTheDocument();
        expect(screen.getByText('IT Operations Console')).toBeInTheDocument();
        expect(screen.getByText('Core Operations')).toBeInTheDocument();
        expect(screen.getByText('Administration')).toBeInTheDocument();
        expect(screen.queryByLabelText('Search users')).not.toBeInTheDocument();

        await act(async () => {
            await router.navigate('/users');
        });

        expect(await screen.findByText('Users Content')).toBeInTheDocument();
        expect(screen.getByLabelText('Workspace sections')).toBe(sidebar);
        expect(screen.queryByLabelText('Search users')).not.toBeInTheDocument();
        expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /toggle sidebar/i })).toBeInTheDocument();
    });

    it('keeps onboarding as a top-level sidebar module without nested child links', async () => {
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

        expect(await screen.findByText('Onboarding Shell')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Onboarding' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Catalog' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Defaults' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'New Joiner' })).not.toBeInTheDocument();
    });

    it('collapses desktop sidebar and persists preference', async () => {
        renderWorkspace('/');

        await screen.findByText('Dashboard Content');

        const toggle = screen.getByRole('button', { name: /toggle sidebar/i });
        const sidebar = screen.getByLabelText('Workspace sections');

        fireEvent.click(toggle);

        expect(sidebar).toHaveClass('is-collapsed');
        expect(window.localStorage.getItem('workspace-sidebar-collapsed')).toBe('true');
    });

    it('opens mobile drawer and closes it after route change', async () => {
        window.matchMedia = createMatchMedia({ isMobile: true, isTablet: false, isDesktop: false });
        const router = renderWorkspace('/');

        await screen.findByText('Dashboard Content');

        const toggle = screen.getByRole('button', { name: /toggle sidebar/i });
        fireEvent.click(toggle);

        expect(screen.getByLabelText('Workspace sections')).toHaveClass('is-drawer-open');

        await act(async () => {
            await router.navigate('/users');
        });

        expect(await screen.findByText('Users Content')).toBeInTheDocument();
        expect(screen.getByLabelText('Workspace sections')).not.toHaveClass('is-drawer-open');
    });
});
