import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const workspaceSession = vi.hoisted(() => {
    let user = null;

    return {
        getUser: () => user,
        setUser: (nextUser) => {
            user = nextUser;
        }
    };
});

vi.mock('../src/features/requests/api/requestsApi.js', () => ({
    fetchAllRequests: vi.fn()
}));

vi.mock('../src/features/requests/hooks/useRequests.js', () => ({
    useAllRequests: vi.fn()
}));

vi.mock('../src/features/requests/components/AdminApprovalModal', () => ({
    default: () => null
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

vi.mock('../src/features/requests/pages/ReviewRequestsPage.jsx', () => ({
    default: () => <div>Review Queue View</div>
}));

import { fetchAllRequests } from '../src/features/requests/api/requestsApi.js';
import { useAllRequests } from '../src/features/requests/hooks/useRequests.js';
import { router as appRouter } from '../src/routes/router.jsx';

const adminUser = {
    id: 'user-1',
    username: 'alice.admin',
    role: 'admin',
    status: 'active'
};

const requesterUser = {
    id: 'user-2',
    username: 'riley.requester',
    role: 'requester',
    status: 'active'
};

const headItUser = {
    id: 'user-3',
    username: 'harry.head',
    role: 'head_it',
    status: 'active'
};

const createQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: { retry: false, gcTime: 0 }
    }
});

const renderProductionRequestsRoute = ({ initialEntry = '/requests', user = adminUser } = {}) => {
    workspaceSession.setUser(user);

    const router = createMemoryRouter(appRouter.routes, {
        initialEntries: [initialEntry]
    });

    render(
        <QueryClientProvider client={createQueryClient()}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    );

    return { router };
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

        useAllRequests.mockReturnValue({
            data: {
                data: [
                    {
                        id: 'approval-1',
                        itemName: '4K Monitor',
                        category: 'Hardware',
                        requester: {
                            username: 'maria',
                            ldapAttributes: {
                                displayName: 'Maria Lee',
                                department: 'Finance'
                            }
                        },
                        itReviewedBy: {
                            username: 'it.staff',
                            ldapAttributes: { displayName: 'IT Staff' }
                        },
                        itReviewedAt: '2026-01-20T08:00:00.000Z',
                        createdAt: '2026-01-19T08:00:00.000Z',
                        priority: 'MEDIUM'
                    }
                ],
                meta: { page: 1, totalPages: 1, total: 1 }
            },
            isLoading: false,
            error: null,
            isFetching: false,
            refetch: vi.fn()
        });
    });

    it('renders shared requests module tabs and keeps review active on nested routes', async () => {
        renderProductionRequestsRoute();

        expect(await screen.findByRole('heading', { name: 'Requests' })).toBeInTheDocument();
        const moduleTabs = screen.getByRole('navigation', { name: 'Requests sections' });

        expect(moduleTabs).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: 'Review Queue' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Approvals' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Needs Review' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Waiting for Approval' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Blocked' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Recently Completed' })).toBeInTheDocument();
        expect(document.querySelector('.requests-subnav')).not.toBeInTheDocument();
    });

    it('keeps review queue active inside shared module tabs', async () => {
        renderProductionRequestsRoute({ initialEntry: '/requests/review' });

        expect(await screen.findByText('Review Queue View')).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Requests sections' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Review Queue' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: 'Approvals' })).toBeInTheDocument();
    });

    it('lets admin users open approvals and keeps the approvals tab active', async () => {
        renderProductionRequestsRoute({ initialEntry: '/requests/approvals', user: adminUser });

        expect(await screen.findByRole('heading', { name: 'Approval Queue' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Approvals' })).toHaveAttribute('aria-current', 'page');
    });

    it('lets head_it users open approvals and keeps the approvals tab active', async () => {
        renderProductionRequestsRoute({ initialEntry: '/requests/approvals', user: headItUser });

        expect(await screen.findByRole('heading', { name: 'Approval Queue' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Approvals' })).toHaveAttribute('aria-current', 'page');
    });

    it('hides approvals from requester users', async () => {
        renderProductionRequestsRoute({ user: requesterUser });

        expect(await screen.findByRole('heading', { name: 'Requests' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Approvals' })).not.toBeInTheDocument();
    });

    it('redirects requester users away from /requests/approvals', async () => {
        const { router } = renderProductionRequestsRoute({ initialEntry: '/requests/approvals', user: requesterUser });

        expect(await screen.findByText('Dashboard Content')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/');
        expect(screen.queryByRole('heading', { name: 'Approval Queue' })).not.toBeInTheDocument();
    });

    it('redirects legacy admin approvals route into the requests module flow', async () => {
        renderProductionRequestsRoute({ initialEntry: '/admin/approvals', user: adminUser });

        expect(await screen.findByRole('heading', { name: 'Approval Queue' })).toBeInTheDocument();
    });
});
