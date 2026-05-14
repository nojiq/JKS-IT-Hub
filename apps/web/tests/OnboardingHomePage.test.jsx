import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../src/shared/context/ThemeProvider';
import { WorkspaceLayout } from '../src/shared/workspace/WorkspaceLayout';
import { OnboardingLayout } from '../src/features/onboarding/OnboardingLayout.jsx';
import OnboardingHomePage from '../src/features/onboarding/pages/OnboardingHomePage.jsx';

vi.mock('../src/features/users/auth-api', () => ({
    fetchSession: vi.fn(),
    logout: vi.fn()
}));

vi.mock('../src/features/notifications/components/NotificationBell', () => ({
    NotificationBell: () => <div data-testid="notification-bell" />
}));

vi.mock('../src/features/onboarding/onboarding-api.js', () => ({
    fetchCatalogItems: vi.fn(),
    fetchDepartmentBundles: vi.fn(),
    previewOnboardingSetup: vi.fn(),
    confirmOnboardingSetup: vi.fn(),
    fetchUsersForOnboarding: vi.fn(),
    createCatalogItem: vi.fn(),
    createDepartmentBundle: vi.fn(),
    deleteCatalogItem: vi.fn(),
    deleteDepartmentBundle: vi.fn(),
    updateCatalogItem: vi.fn(),
    updateDepartmentBundle: vi.fn()
}));

import { fetchSession } from '../src/features/users/auth-api';
import {
    fetchCatalogItems,
    fetchDepartmentBundles,
    fetchUsersForOnboarding
} from '../src/features/onboarding/onboarding-api.js';

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

const renderApp = async (initialPath = '/onboarding') => {
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
                        { index: true, element: <OnboardingHomePage /> },
                        { path: 'new-joiner', element: <div>New Joiner Content</div> },
                        { path: 'defaults', element: <div>Defaults Content</div> },
                        { path: 'catalog', element: <div>Catalog Content</div> }
                    ]
                }
            ]
        }
    ], {
        initialEntries: [initialPath]
    });

    render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <RouterProvider router={router} />
            </ThemeProvider>
        </QueryClientProvider>
    );
};

describe('OnboardingHomePage route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        window.matchMedia = createMatchMedia();

        fetchSession.mockResolvedValue({
            user: {
                id: 'user-1',
                username: 'alice.dev',
                role: 'dev',
                status: 'active'
            }
        });

        fetchCatalogItems.mockResolvedValue([
            { id: 'sigma', itemKey: 'sigma', label: 'Sigma' },
            { id: 'basecamp', itemKey: 'basecamp', label: 'Basecamp' }
        ]);

        fetchDepartmentBundles.mockResolvedValue([
            { id: 'marketing', department: 'Marketing', catalogItemKeys: ['sigma'], isActive: true }
        ]);

        fetchUsersForOnboarding.mockResolvedValue([
            {
                id: 'user-1',
                username: 'haziq.afendi',
                displayName: 'Haziq Afendi',
                email: 'haziq.afendi@jkseng.com',
                department: 'Business Development'
            }
        ]);
    });

    it('opens /onboarding on an overview page with module-local nav', async () => {
        await renderApp('/onboarding');

        expect(await screen.findByRole('heading', { name: 'Onboarding' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Onboarding' })).toHaveClass('is-active');
        expect(screen.getByRole('link', { name: /create new user/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /review reusable defaults/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /open app catalog/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Start New Joiner' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Direct User Creation' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'In Progress' })).not.toBeInTheDocument();
        expect(screen.queryByText(/draft/i)).not.toBeInTheDocument();
    });
});
