import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserDetailPage from '../src/features/users/user-detail-page.jsx';

vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(() => ({
        invalidateQueries: vi.fn()
    }))
}));

vi.mock('../src/features/credentials/hooks/useCredentials.js', () => ({
    useUserCredentials: vi.fn(),
    useInitiateRegeneration: vi.fn(),
    useConfirmRegeneration: vi.fn()
}));

vi.mock('../src/features/credentials/generation/CredentialGenerator.jsx', () => ({
    default: () => <div>Credential Generator Stub</div>
}));

vi.mock('../src/features/credentials/regeneration', () => ({
    CredentialRegeneration: () => <div>Credential Regeneration Stub</div>
}));

vi.mock('../src/features/credentials/components/CredentialList.jsx', () => ({
    default: () => <div>Credential List Stub</div>
}));

vi.mock('../src/features/credentials/components/DisabledUserBanner.jsx', () => ({
    default: () => <div>Disabled User Banner Stub</div>
}));

vi.mock('../src/features/exports/components/CredentialExportButton.jsx', () => ({
    CredentialExportButton: () => <button type="button">Export Credentials</button>
}));

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    useConfirmRegeneration,
    useInitiateRegeneration,
    useUserCredentials
} from '../src/features/credentials/hooks/useCredentials.js';

const createQueryResult = (overrides = {}) => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides
});

/** Stable query payloads so `user` identity does not change every render (avoids effect loops). */
const sessionPayload = Object.freeze({
    user: Object.freeze({
        id: 'admin-1',
        username: 'admin.user',
        role: 'admin',
        status: 'active'
    })
});

const userDetailPayload = Object.freeze({
    user: Object.freeze({
        id: 'user-1',
        username: 'jane.doe',
        role: 'requester',
        status: 'active',
        ldapSyncedAt: '2026-04-16T01:00:00.000Z',
        orgSyncedAt: '2026-05-13T00:00:00.000Z',
        orgSnapshot: Object.freeze({
            division: Object.freeze({ id: 'div-1', name: 'CORPORATE SERVICES' }),
            department: Object.freeze({ id: 'dept-1', code: 'IT', name: 'IT' }),
            section: Object.freeze({ id: 'sec-1', name: 'INFRASTRUCTURE' }),
            source: 'jkspulse',
            matchedBy: 'email',
            confidence: 'exact'
        }),
        ldapFields: Object.freeze({ mail: 'jane@example.com', department: 'Finance', birthDate: '1998-01-02' })
    }),
    fields: Object.freeze(['mail', 'department', 'birthDate'])
});

const historyPayload = Object.freeze([]);

const renderPage = () => {
    const router = createMemoryRouter(
        [{ path: '/users/:id', element: <UserDetailPage /> }],
        { initialEntries: ['/users/user-1'] }
    );

    return render(<RouterProvider router={router} />);
};

describe('UserDetailPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useQuery.mockReset();
        useMutation.mockReset();
        useQueryClient.mockReturnValue({ invalidateQueries: vi.fn() });
        useMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
        useUserCredentials.mockReturnValue(createQueryResult({ data: { data: [] } }));
        useInitiateRegeneration.mockReturnValue({ mutateAsync: vi.fn() });
        useConfirmRegeneration.mockReturnValue({ mutateAsync: vi.fn() });
    });

    it('renders shared loading state while session check pending', () => {
        useQuery.mockImplementation(({ queryKey }) => {
            if (queryKey[0] === 'session') {
                return createQueryResult({ isLoading: true });
            }

            return createQueryResult();
        });

        const { container } = renderPage();

        expect(screen.getByText('Loading user workspace')).toBeInTheDocument();
        expect(container.querySelector('.workspace-state-block')).not.toBeNull();
    });

    it('renders distinct operational zones for identity, status, credentials, and recent actions', () => {
        useQuery.mockImplementation(({ queryKey }) => {
            if (queryKey[0] === 'session') {
                return createQueryResult({
                    data: sessionPayload
                });
            }

            if (queryKey[0] === 'users' && queryKey[2] !== 'history') {
                return createQueryResult({
                    data: userDetailPayload
                });
            }

            if (queryKey[0] === 'users' && queryKey[2] === 'history') {
                return createQueryResult({ data: historyPayload });
            }

            return createQueryResult();
        });

        const { container } = renderPage();

        expect(screen.getByRole('heading', { name: 'jane.doe' })).toBeInTheDocument();
        expect(screen.getByText('Identity')).toBeInTheDocument();
        expect(screen.getByText('Division')).toBeInTheDocument();
        expect(screen.getByText('CORPORATE SERVICES')).toBeInTheDocument();
        expect(screen.getAllByText('Department').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('IT').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Section')).toBeInTheDocument();
        expect(screen.getByText('INFRASTRUCTURE')).toBeInTheDocument();
        expect(screen.getAllByText('Source: JKSPulse').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('02/01/1998')).toBeInTheDocument();
        expect(screen.queryByText('1998-01-02')).not.toBeInTheDocument();
        expect(screen.getByText('Account Status')).toBeInTheDocument();
        expect(screen.getByText('Credential Generator Stub')).toBeInTheDocument();
        expect(screen.getByText('Recent Actions')).toBeInTheDocument();
        expect(container.querySelectorAll('.workspace-panel.workspace-panel-detail').length).toBeGreaterThanOrEqual(2);
        expect(container.querySelector('.user-detail-card')).toBeNull();
    });
});
