import { render, screen } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UsersListPage from '../src/features/users/users-list-page';

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query');
    return {
        ...actual,
        useQuery: vi.fn()
    };
});

vi.mock('../src/features/exports/components/BatchCredentialExportButton.jsx', () => ({
    BatchCredentialExportButton: () => <button type="button">Export</button>
}));

vi.mock('../src/features/users/ldap-sync-panel.jsx', () => ({
    default: () => <div>LDAP Sync Panel Stub</div>
}));

import { useQuery } from '@tanstack/react-query';

const renderPage = () => {
    const router = createMemoryRouter([
        {
            path: '/',
            element: <Outlet context={{ user: { role: 'it', username: 'alice.it' } }} />,
            children: [{ index: true, element: <UsersListPage /> }]
        }
    ]);

    return render(<RouterProvider router={router} />);
};

const createMatchMedia = (isMobile = false) =>
    vi.fn().mockImplementation((query) => ({
        matches: query === '(max-width: 767px)' ? isMobile : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
    }));

describe('UsersListPage states', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useQuery.mockReset();
        window.matchMedia = createMatchMedia(false);
    });

    it('renders shared loading state', () => {
        useQuery.mockReturnValue({
            data: null,
            isLoading: true,
            error: null,
            isFetching: false,
            refetch: vi.fn()
        });

        renderPage();
        expect(screen.getByText('Loading users')).toBeInTheDocument();
    });

    it('renders shared error state', () => {
        useQuery.mockReturnValue({
            data: null,
            isLoading: false,
            error: new Error('users api failed'),
            isFetching: false,
            refetch: vi.fn()
        });

        renderPage();
        expect(screen.getByText('Unable to load users')).toBeInTheDocument();
    });

    it('renders shared empty state', () => {
        useQuery.mockReturnValue({
            data: { users: [], fields: [], meta: {} },
            isLoading: false,
            error: null,
            isFetching: false,
            refetch: vi.fn()
        });

        renderPage();
        expect(screen.getByText('No users found')).toBeInTheDocument();
    });

    it('renders the LDAP sync panel on the users page and removes the dashboard back-link framing', () => {
        useQuery.mockReturnValue({
            data: {
                users: [],
                fields: [],
                meta: {}
            },
            isLoading: false,
            error: null,
            isFetching: false,
            refetch: vi.fn()
        });

        renderPage();

        expect(screen.getByText('LDAP Sync Panel Stub')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Back to dashboard' })).not.toBeInTheDocument();
    });

    it('points the sync helper link back to the users page', () => {
        useQuery.mockReturnValue({
            data: {
                users: [],
                fields: [],
                meta: {}
            },
            isLoading: false,
            error: null,
            isFetching: false,
            refetch: vi.fn()
        });

        renderPage();

        expect(screen.getByRole('link', { name: 'Go to sync panel' })).toHaveAttribute('href', '/users');
    });

    it('renders desktop table layout by default', () => {
        useQuery.mockReturnValue({
            data: {
                users: [
                    {
                        id: '1',
                        username: 'alice',
                        role: 'requester',
                        status: 'active',
                        ldapFields: { mail: 'alice@example.com' }
                    }
                ],
                fields: ['mail'],
                meta: {}
            },
            isLoading: false,
            error: null,
            isFetching: false,
            refetch: vi.fn()
        });

        renderPage();
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.queryByRole('list', { name: 'Users list' })).not.toBeInTheDocument();
    });

    it('renders mobile card layout on mobile viewport', () => {
        window.matchMedia = createMatchMedia(true);
        useQuery.mockReturnValue({
            data: {
                users: [
                    {
                        id: '1',
                        username: 'alice',
                        role: 'requester',
                        status: 'active',
                        ldapFields: { mail: 'alice@example.com' }
                    }
                ],
                fields: ['mail'],
                meta: {}
            },
            isLoading: false,
            error: null,
            isFetching: false,
            refetch: vi.fn()
        });

        renderPage();
        expect(screen.getByRole('list', { name: 'Users list' })).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
});
