import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReviewRequestsPage from '../src/features/requests/pages/ReviewRequestsPage';

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query');
    return {
        ...actual,
        useQueryClient: () => ({
            invalidateQueries: vi.fn()
        })
    };
});

vi.mock('../src/features/requests/hooks/useRequests.js', () => ({
    useAllRequests: vi.fn()
}));

vi.mock('../src/shared/hooks/useSSE.js', () => ({
    useSSE: vi.fn()
}));

vi.mock('../src/features/requests/components/RequestReviewModal', () => ({
    default: ({ request }) => <div data-testid="request-review-modal">{request?.itemName}</div>
}));

import { useAllRequests } from '../src/features/requests/hooks/useRequests.js';

const renderPage = () => {
    return render(
        <MemoryRouter initialEntries={['/requests/review']}>
            <ReviewRequestsPage />
        </MemoryRouter>
    );
};

const baseResult = {
    data: [
        {
            id: 'req-1',
            itemName: 'Laptop Stand',
            requester: {
                username: 'john',
                ldapAttributes: {
                    displayName: 'John Doe',
                    department: 'IT'
                }
            },
            createdAt: '2026-01-15T10:00:00.000Z',
            priority: 'HIGH',
            status: 'SUBMITTED',
            invoiceFileUrl: null
        },
        {
            id: 'req-2',
            itemName: 'Docking Station',
            requester: {
                username: 'sarah',
                ldapAttributes: {
                    displayName: 'Sarah Tan',
                    department: 'Operations'
                }
            },
            createdAt: '2026-01-14T10:00:00.000Z',
            priority: 'LOW',
            status: 'IT_REVIEWED',
            invoiceFileUrl: 'https://example.com/invoice.pdf'
        }
    ],
    meta: { page: 1, totalPages: 1, total: 2 }
};

describe('ReviewRequestsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAllRequests.mockReset();
    });

    it('renders sticky workspace pattern and toggles bulk actions by selection count', () => {
        useAllRequests.mockReturnValue({
            data: baseResult,
            isLoading: false,
            error: null,
            isFetching: false,
            refetch: vi.fn()
        });

        const { container } = renderPage();

        expect(container.querySelector('.workspace-filter-bar')).toBeInTheDocument();
        expect(container.querySelector('.workspace-table-container')).toBeInTheDocument();
        expect(container.querySelector('.workspace-table thead th')).toBeInTheDocument();
        expect(screen.queryByText('1 selected')).not.toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Select request Laptop Stand'));
        expect(screen.getByText('1 selected')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Select request Laptop Stand'));
        expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
    });

    it('renders shared loading state', () => {
        useAllRequests.mockReturnValue({
            data: null,
            isLoading: true,
            error: null,
            isFetching: false,
            refetch: vi.fn()
        });
        const loadingView = renderPage();
        expect(screen.getByText('Loading review requests')).toBeInTheDocument();
        loadingView.unmount();
    });

    it('renders shared error state', () => {
        useAllRequests.mockReturnValue({
            data: null,
            isLoading: false,
            error: new Error('network failed'),
            isFetching: false,
            refetch: vi.fn()
        });
        const errorView = renderPage();
        expect(screen.getByText('Unable to load review requests')).toBeInTheDocument();
        errorView.unmount();
    });

    it('renders shared empty state', () => {
        useAllRequests.mockReturnValue({
            data: { data: [], meta: {} },
            isLoading: false,
            error: null,
            isFetching: false,
            refetch: vi.fn()
        });
        renderPage();
        expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
});
