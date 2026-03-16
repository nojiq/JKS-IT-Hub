import { render, screen } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from '../src/features/users/home-page';

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query');
    return {
        ...actual,
        useQuery: vi.fn()
    };
});

import { useQuery } from '@tanstack/react-query';

const renderPage = (user) => {
    const router = createMemoryRouter([
        {
            path: '/',
            element: <Outlet context={{ user }} />,
            children: [{ index: true, element: <HomePage /> }]
        }
    ]);

    return render(<RouterProvider router={router} />);
};

const createQueryResult = (overrides = {}) => ({
    data: null,
    isLoading: false,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides
});

describe('HomePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useQuery.mockReset();
    });

    it('renders an admin ops overview instead of a personal welcome card', () => {
        useQuery.mockImplementation(({ queryKey }) => {
            if (queryKey[0] === 'users') {
                return createQueryResult({
                    data: {
                        users: [
                            { id: '1', status: 'active' },
                            { id: '2', status: 'disabled' }
                        ],
                        fields: [],
                        meta: { total: 2 }
                    }
                });
            }

            if (queryKey[0] === 'notifications' && queryKey[1] === 'unread-count') {
                return createQueryResult({ data: { data: { count: 4 } } });
            }

            if (queryKey[0] === 'requests') {
                return createQueryResult({ data: { data: [{ id: 'r1' }, { id: 'r2' }], meta: { total: 2 } } });
            }

            if (queryKey[0] === 'maintenance') {
                return createQueryResult({
                    data: {
                        data: [
                            { id: 'm1', status: 'UPCOMING' },
                            { id: 'm2', status: 'OVERDUE' }
                        ],
                        meta: { total: 2 }
                    }
                });
            }

            if (queryKey[0] === 'audit-logs') {
                return createQueryResult({
                    data: {
                        data: [
                            { id: 'a1', action: 'USER_UPDATED', createdAt: '2026-03-14T09:00:00Z' }
                        ]
                    }
                });
            }

            return createQueryResult();
        });

        renderPage({ role: 'admin', username: 'admin.user', status: 'active' });

        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.queryByText('Welcome back')).not.toBeInTheDocument();
        expect(screen.queryByText('Directory Synchronization')).not.toBeInTheDocument();
        expect(screen.getByText('Unread Notifications')).toBeInTheDocument();
        expect(screen.getByText('Users in Directory')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Review Queue' })).toBeInTheDocument();
        expect(screen.getByText('Maintenance Status')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Recent Audit Activity' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Open Users Directory' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Manage Systems & Rules' })).toBeInTheDocument();
    });

    it('renders requester-focused work and hides admin-only ops panels', () => {
        useQuery.mockImplementation(({ queryKey }) => {
            if (queryKey[0] === 'users') {
                return createQueryResult({
                    data: {
                        users: [{ id: '1', status: 'active' }],
                        fields: [],
                        meta: { total: 1 }
                    }
                });
            }

            if (queryKey[0] === 'notifications' && queryKey[1] === 'unread-count') {
                return createQueryResult({ data: { data: { count: 1 } } });
            }

            if (queryKey[0] === 'requests') {
                return createQueryResult({ data: { data: [{ id: 'r1' }], meta: { total: 1 } } });
            }

            return createQueryResult();
        });

        renderPage({ role: 'requester', username: 'req.user', status: 'active' });

        expect(screen.getByRole('heading', { name: 'My Requests' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Recent Notifications' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Recent Audit Activity' })).not.toBeInTheDocument();
        expect(screen.queryByText('Maintenance Status')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Manage Systems & Rules' })).not.toBeInTheDocument();
    });
});
