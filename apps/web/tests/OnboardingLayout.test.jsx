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

const adminUser = {
    id: 'user-1',
    username: 'alice.it',
    role: 'admin',
    status: 'active'
};

const renderApp = ({ initialEntry = '/onboarding', user = adminUser } = {}) => {
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
            user: adminUser
        });
    });

    it('renders shared onboarding module tabs and keeps overview active at the root route', async () => {
        renderApp();

        expect(await screen.findByRole('heading', { name: 'Onboarding' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Onboarding' })).toBeInTheDocument();
        expect(screen.getByText('Prepare access, defaults, and credential packs for new joiners.')).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Onboarding sections' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: 'New Joiner' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Defaults' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Catalog' })).toBeInTheDocument();
        expect(document.querySelector('.onboarding-subnav')).not.toBeInTheDocument();
        expect(screen.getByText('Overview Content')).toBeInTheDocument();
    });

    it('keeps new joiner active inside shared module tabs', async () => {
        renderApp({ initialEntry: '/onboarding/new-joiner' });

        expect(await screen.findByText('New Joiner Content')).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Onboarding sections' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'New Joiner' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: 'Defaults' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Catalog' })).toBeInTheDocument();
        expect(screen.getByText('New Joiner Content')).toBeInTheDocument();
    });

    it.each([
        ['it'],
        ['head_it']
    ])('allows %s users to open the onboarding module', async (role) => {
        renderApp({
            user: {
                id: `user-${role}`,
                username: `${role}.user`,
                role,
                status: 'active'
            }
        });

        expect(await screen.findByRole('heading', { name: 'Onboarding' })).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Onboarding sections' })).toBeInTheDocument();
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
