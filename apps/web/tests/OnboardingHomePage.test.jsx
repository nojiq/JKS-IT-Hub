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
    fetchOnboardingDrafts: vi.fn(),
    linkAndPromoteOnboardingDraft: vi.fn(),
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
    fetchOnboardingDrafts,
    fetchUsersForOnboarding
} from '../src/features/onboarding/onboarding-api.js';

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

        fetchSession.mockResolvedValue({
            user: {
                id: 'user-1',
                username: 'alice.it',
                role: 'admin',
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

        fetchOnboardingDrafts.mockResolvedValue([
            {
                id: 'draft-1',
                fullName: 'Haziq Afendi',
                email: 'haziq.afendi@jkseng.com',
                department: 'Business Development',
                status: 'draft',
                linkedUserId: null,
                setupSheet: { entries: [{ systemId: 'sigma' }] }
            },
            {
                id: 'draft-2',
                fullName: 'Nur Aina',
                email: 'nur.aina@jkseng.com',
                department: 'Marketing',
                status: 'completed',
                linkedUserId: 'user-2',
                setupSheet: { entries: [{ systemId: 'basecamp' }] }
            }
        ]);
    });

    it('opens /onboarding on an overview page with module-local nav', async () => {
        await renderApp('/onboarding');

        expect(await screen.findByRole('heading', { name: 'Onboarding' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Overview' })).toHaveClass('is-active');
        expect(screen.getByRole('link', { name: 'New Joiner' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Defaults' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Catalog' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Start New Joiner' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'In Progress' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Ready for Credential Generation' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Completed Recently' })).toBeInTheDocument();
    });
});
