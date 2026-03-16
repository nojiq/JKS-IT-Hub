import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../src/shared/context/ThemeProvider';
import { WorkspaceLayout } from '../src/shared/workspace/WorkspaceLayout';
import { OnboardingLayout } from '../src/features/onboarding/OnboardingLayout.jsx';

vi.mock('../src/features/users/auth-api', () => ({
    fetchSession: vi.fn(),
    logout: vi.fn()
}));

vi.mock('../src/features/notifications/components/NotificationBell', () => ({
    NotificationBell: () => <div data-testid="notification-bell" />
}));

import { fetchSession } from '../src/features/users/auth-api';

const renderApp = (initialEntry = '/onboarding/new-joiner') => {
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
                {
                    path: 'onboarding',
                    element: <OnboardingLayout />,
                    children: [
                        { path: 'catalog', element: <div>Catalog Content</div> },
                        { path: 'defaults', element: <div>Defaults Content</div> },
                        { path: 'new-joiner', element: <div>New Joiner Content</div> }
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

describe('Onboarding navigation', () => {
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

    it('shows Onboarding in the workspace nav and renders nested onboarding links in the sidebar', async () => {
        renderApp();

        expect(await screen.findByRole('link', { name: 'Onboarding' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Onboarding' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Catalog' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Defaults' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'New Joiner' })).toBeInTheDocument();
        expect(screen.getByLabelText('Workspace sections')).toContainElement(screen.getByRole('link', { name: 'Catalog' }));
        expect(document.querySelector('.onboarding-subnav')).not.toBeInTheDocument();
        expect(screen.getByText('New Joiner Content')).toBeInTheDocument();
    });
});
