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

const hasExactText = (value) => (_, element) => element?.tagName === 'LI' && element?.textContent === value;

describe('HomePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useQuery.mockReset();
    });

    it('renders a module launcher in IT workflow priority order', () => {
        useQuery.mockImplementation(({ queryKey }) => {
            if (queryKey[0] === 'users') {
                return createQueryResult({
                    data: {
                        users: [
                            { id: '1', status: 'active' },
                            { id: '2', status: 'disabled' },
                            { id: '3', status: 'active' }
                        ],
                        fields: [],
                        meta: { total: 3 }
                    }
                });
            }

            if (queryKey[0] === 'requests' && queryKey[2]?.status === 'SUBMITTED') {
                return createQueryResult({
                    data: { data: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }], meta: { total: 3 } }
                });
            }

            if (queryKey[0] === 'requests' && queryKey[2]?.status === 'IT_REVIEWED') {
                return createQueryResult({
                    data: { data: [{ id: 'a1' }], meta: { total: 1 } }
                });
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

            return createQueryResult();
        });

        const { container } = renderPage({ role: 'admin', username: 'admin.user', status: 'active' });

        expect(screen.getByRole('heading', { name: 'Operations' })).toBeInTheDocument();
        expect(screen.queryByText('Unread Notifications')).not.toBeInTheDocument();
        expect(screen.queryByText('Users in Directory')).not.toBeInTheDocument();
        expect(container.querySelector('.workspace-module-launcher-grid')).toBeInTheDocument();

        const moduleTitles = [...container.querySelectorAll('.workspace-module-card-title')].map((node) => node.textContent);
        expect(moduleTitles).toEqual(['Requests', 'Onboarding', 'Users & Credentials', 'Maintenance']);

        expect(screen.getByRole('link', { name: /open requests/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /open onboarding/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /open users & credentials/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /open maintenance/i })).toBeInTheDocument();
        expect(screen.getByText(hasExactText('3 need IT review'))).toBeInTheDocument();
        expect(screen.getByText(hasExactText('1 waiting for approval'))).toBeInTheDocument();
        expect(screen.getByText(hasExactText('3 total users'))).toBeInTheDocument();
        expect(screen.getByText(hasExactText('1 overdue'))).toBeInTheDocument();
    });

    it('keeps launcher cards visible even when some operational counts are unavailable', () => {
        useQuery.mockImplementation(({ queryKey }) => {
            if (queryKey[0] === 'users') {
                return createQueryResult({
                    data: {
                        users: [],
                        fields: [],
                        meta: { total: 0 }
                    }
                });
            }

            if (queryKey[0] === 'requests') {
                return createQueryResult({
                    data: { data: [], meta: { total: 0 } }
                });
            }

            if (queryKey[0] === 'maintenance') {
                return createQueryResult({
                    data: { data: [], meta: { total: 0 } }
                });
            }

            return createQueryResult();
        });

        renderPage({ role: 'it', username: 'it.user', status: 'active' });

        expect(screen.getByRole('heading', { name: 'Operations' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /open requests/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /open onboarding/i })).toBeInTheDocument();
        expect(screen.getByText('Start a new joiner setup or manage defaults.')).toBeInTheDocument();
    });
});
