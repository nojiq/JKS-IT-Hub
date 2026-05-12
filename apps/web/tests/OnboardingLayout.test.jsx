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

vi.mock('../src/features/onboarding/pages/OnboardingHomePage.jsx', () => ({
    default: () => <div>Overview Content</div>
}));

vi.mock('../src/features/onboarding/pages/CatalogPage.jsx', () => ({
    CatalogPage: () => <div>Catalog Content</div>
}));

vi.mock('../src/features/onboarding/pages/OnboardingDefaultsPage.jsx', () => ({
    OnboardingDefaultsPage: () => <div>Defaults Content</div>
}));

vi.mock('../src/features/onboarding/pages/OnboardingDefaultsEditor.jsx', () => ({
    OnboardingDefaultsEditor: () => <div>Defaults Editor Content</div>
}));

vi.mock('../src/features/onboarding/pages/NewJoinerPage.jsx', () => ({
    NewJoinerPage: () => <div>New Joiner Content</div>
}));

import { fetchSession } from '../src/features/users/auth-api';
import { router as appRouter } from '../src/routes/router.jsx';

const devUser = {
    id: 'user-dev',
    username: 'dev.user',
    role: 'dev',
    status: 'active'
};

const renderApp = ({ initialEntry = '/onboarding', user = devUser } = {}) => {
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

describe('Onboarding navigation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchSession.mockResolvedValue({
            user: devUser
        });
    });

    it('renders onboarding shell for developer users', async () => {
        renderApp();

        expect(await screen.findByRole('heading', { name: 'Onboarding' })).toBeInTheDocument();
        expect(screen.getByText('Overview Content')).toBeInTheDocument();
    });

    it('renders new joiner route for developer users', async () => {
        renderApp({ initialEntry: '/onboarding/new-joiner' });

        expect(await screen.findByText('New Joiner Content')).toBeInTheDocument();
    });

    it.each([
        ['it'],
        ['head_it'],
        ['admin']
    ])('redirects %s users away from onboarding', async (role) => {
        renderApp({
            user: {
                id: `user-${role}`,
                username: `${role}.user`,
                role,
                status: 'active'
            }
        });

        expect(await screen.findByText('Dashboard Content')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Onboarding' })).not.toBeInTheDocument();
    });

    it('redirects unauthorized users to / and does not render the onboarding shell', async () => {
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
        expect(screen.queryByRole('heading', { name: 'Onboarding' })).not.toBeInTheDocument();
    });
});
