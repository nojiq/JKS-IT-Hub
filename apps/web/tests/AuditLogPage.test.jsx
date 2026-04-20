import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuditLogPage from '../src/features/audit/audit-log-page.jsx';

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query');
    return {
        ...actual,
        useQuery: vi.fn()
    };
});

import { useQuery } from '@tanstack/react-query';

const createQueryResult = (overrides = {}) => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides
});

const renderPage = () => {
    const router = createMemoryRouter(
        [{ path: '/audit-logs', element: <AuditLogPage /> }],
        { initialEntries: ['/audit-logs'] }
    );

    return render(<RouterProvider router={router} />);
};

describe('AuditLogPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useQuery.mockReset();
    });

    it('renders shared loading state while session pending', () => {
        useQuery.mockImplementation(({ queryKey }) => {
            if (queryKey[0] === 'session') {
                return createQueryResult({ isLoading: true });
            }

            return createQueryResult();
        });

        const { container } = renderPage();

        expect(screen.getByText('Loading audit workspace')).toBeInTheDocument();
        expect(container.querySelector('.workspace-state-block')).not.toBeNull();
    });

    it('renders workspace header and table panel for loaded logs', () => {
        useQuery.mockImplementation(({ queryKey }) => {
            if (queryKey[0] === 'session') {
                return createQueryResult({
                    data: { user: { id: 'admin-1', username: 'admin.user', role: 'admin', status: 'active' } }
                });
            }

            if (queryKey[0] === 'audit-logs') {
                return createQueryResult({
                    data: {
                        data: [
                            {
                                id: 'log-1',
                                timestamp: '2026-04-16T01:00:00.000Z',
                                actor: { username: 'admin.user', role: 'admin', status: 'active' },
                                action: 'user.status_change',
                                target: 'user-1',
                                metadata: { field: 'status', from: 'active', to: 'disabled' }
                            }
                        ],
                        meta: { total: 1, page: 1, limit: 20 }
                    }
                });
            }

            return createQueryResult();
        });

        const { container } = renderPage();

        expect(screen.getByRole('heading', { name: 'Audit' })).toBeInTheDocument();
        expect(screen.getByText('Review system activity, investigate changes, and trace sensitive actions.')).toBeInTheDocument();
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(container.querySelector('.workspace-page-header')).not.toBeNull();
        expect(container.querySelectorAll('.workspace-panel.workspace-panel-table').length).toBeGreaterThanOrEqual(1);
        expect(container.querySelector('.users-header')).toBeNull();
        expect(screen.queryByText('Audit Logs')).not.toBeInTheDocument();
    });
});
