import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminApprovalPage from '../src/features/requests/pages/AdminApprovalPage';

vi.mock('../src/features/requests/hooks/useRequests.js', () => ({
    useAllRequests: vi.fn()
}));

vi.mock('../src/features/requests/components/AdminApprovalModal', () => ({
    default: ({ request }) => <div data-testid="admin-approval-modal">{request?.itemName}</div>
}));

import { useAllRequests } from '../src/features/requests/hooks/useRequests.js';

const renderPage = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 }
        }
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/admin/approvals']}>
                <AdminApprovalPage />
            </MemoryRouter>
        </QueryClientProvider>
    );
};

const approvalResult = {
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
};

describe('AdminApprovalPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAllRequests.mockReset();
    });

    it('shows standardized bulk action row when selection count is non-zero', () => {
        useAllRequests.mockReturnValue({
            data: approvalResult,
            isLoading: false,
            error: null,
            isFetching: false,
            refetch: vi.fn()
        });

        renderPage();

        expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Select request 4K Monitor'));
        expect(screen.getByText('1 selected')).toBeInTheDocument();
    });

    it('shows consistent empty state for admin approvals', () => {
        useAllRequests.mockReturnValue({
            data: { data: [], meta: {} },
            isLoading: false,
            error: null,
            isFetching: false,
            refetch: vi.fn()
        });

        renderPage();

        expect(screen.getByText('No pending approvals')).toBeInTheDocument();
    });
});
