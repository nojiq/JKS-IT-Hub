import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestsLayout } from '../src/features/requests/pages/RequestsLayout.jsx';
import RequestsHomePage from '../src/features/requests/pages/RequestsHomePage.jsx';

vi.mock('../src/features/requests/api/requestsApi.js', () => ({
    fetchAllRequests: vi.fn()
}));

import { fetchAllRequests } from '../src/features/requests/api/requestsApi.js';

const adminUser = {
    id: 'user-1',
    username: 'alice.admin',
    role: 'admin',
    status: 'active'
};

const renderRequestsApp = (initialEntry = '/requests') => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 }
        }
    });

    const router = createMemoryRouter([
        {
            path: '/',
            element: <Outlet context={{ user: adminUser }} />,
            children: [
                {
                    path: 'requests',
                    element: <RequestsLayout />,
                    children: [
                        { index: true, element: <RequestsHomePage /> },
                        { path: 'review', element: <div>Review Queue View</div> },
                        { path: 'approvals', element: <div>Approvals View</div> }
                    ]
                },
                { path: 'admin/approvals', element: <Navigate to="/requests/approvals" replace /> }
            ]
        }
    ], {
        initialEntries: [initialEntry]
    });

    render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    );
};

describe('RequestsHomePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchAllRequests.mockImplementation(async (filters = {}) => {
            if (filters.status === 'SUBMITTED') {
                return { data: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }], meta: { total: 3 } };
            }

            if (filters.status === 'IT_REVIEWED') {
                return { data: [{ id: 'a1' }, { id: 'a2' }], meta: { total: 2 } };
            }

            if (filters.status === 'REJECTED') {
                return { data: [{ id: 'b1' }], meta: { total: 1 } };
            }

            if (filters.status === 'APPROVED') {
                return { data: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }, { id: 'c4' }], meta: { total: 4 } };
            }

            return { data: [], meta: { total: 0 } };
        });
    });

    it('renders the requests module overview with local sub-navigation', async () => {
        renderRequestsApp('/requests');

        expect(await screen.findByRole('heading', { name: 'Requests' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Review Queue' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Approvals' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Needs Review' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Waiting for Approval' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Blocked' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Recently Completed' })).toBeInTheDocument();
    });

    it('redirects legacy admin approvals route into the requests module flow', async () => {
        renderRequestsApp('/admin/approvals');

        expect(await screen.findByText('Approvals View')).toBeInTheDocument();
    });
});
