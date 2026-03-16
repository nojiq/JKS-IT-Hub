import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAllRequests } from '../hooks/useRequests.js';
import RequestReviewModal from '../components/RequestReviewModal';
import { useSSE } from '../../../shared/hooks/useSSE.js';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock';
import { WorkspacePageHeader } from '../../../shared/workspace/WorkspacePageHeader';
import { DesktopFilterBar } from '../../../shared/workspace/DesktopFilterBar';
import { BulkActionsBar } from '../../../shared/workspace/BulkActionsBar';
import { useSharedFilters } from '../../../shared/workspace/useSharedFilters';
import { FilterSelect } from '../../../shared/components/FilterPanel/FilterSelect';
import { SearchEmptyState } from '../../../shared/components/EmptyState/SearchEmptyState';
import '../../../shared/workspace/workspace.css';
import './ReviewRequestsPage.css';

const toDateInputValue = (isoValue) => {
    if (!isoValue) return '';
    const parsed = new Date(isoValue);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
};

const toStartOfDayIso = (dateValue) => {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
};

const toEndOfDayIso = (dateValue) => {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    date.setHours(23, 59, 59, 999);
    return date.toISOString();
};

const statusClass = (status) => `workspace-status-badge status-${String(status || '').toLowerCase().replace(/_/g, '-')}`;
const priorityClass = (priority) => `workspace-priority-badge priority-${String(priority || '').toLowerCase()}`;
const EMPTY_REQUESTS = [];

const ReviewRequestsPage = () => {
    const filterContract = useSharedFilters({ page: '1', perPage: '20', status: 'SUBMITTED' });
    const { data: result, isLoading, error, isFetching, refetch } = useAllRequests(filterContract.filters);
    const queryClient = useQueryClient();

    const [selectedRequestId, setSelectedRequestId] = useState(null);
    const [selectedRequestIds, setSelectedRequestIds] = useState(new Set());

    const handleRequestEvent = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['requests'] });
    }, [queryClient]);

    useSSE('request.created', handleRequestEvent);
    useSSE('request.updated', handleRequestEvent);
    useSSE('request.status_changed', handleRequestEvent);

    const requests = result?.data ?? EMPTY_REQUESTS;
    const meta = result?.meta ?? {};

    useEffect(() => {
        setSelectedRequestIds((previous) => {
            const allowedIds = new Set(requests.map((entry) => entry.id));
            const nextIds = [...previous].filter((id) => allowedIds.has(id));
            if (nextIds.length === previous.size && nextIds.every((id) => previous.has(id))) {
                return previous;
            }
            return new Set(nextIds);
        });
    }, [requests]);

    const panelFilters = useMemo(() => ({
        status: filterContract.filters.status === 'SUBMITTED' ? '' : (filterContract.filters.status || ''),
        priority: filterContract.filters.priority || '',
        dateFrom: toDateInputValue(filterContract.filters.dateFrom),
        dateTo: toDateInputValue(filterContract.filters.dateTo)
    }), [filterContract.filters.dateFrom, filterContract.filters.dateTo, filterContract.filters.priority, filterContract.filters.status]);

    const handlePanelFilterChange = useCallback((nextPanelFilters) => {
        filterContract.apply({
            status: nextPanelFilters.status || 'SUBMITTED',
            priority: nextPanelFilters.priority || '',
            dateFrom: toStartOfDayIso(nextPanelFilters.dateFrom),
            dateTo: toEndOfDayIso(nextPanelFilters.dateTo)
        });
    }, [filterContract]);

    const toggleSelectAll = (checked) => {
        if (checked) {
            setSelectedRequestIds(new Set(requests.map((entry) => entry.id)));
            return;
        }

        setSelectedRequestIds(new Set());
    };

    const toggleSelected = (requestId) => {
        setSelectedRequestIds((previous) => {
            const next = new Set(previous);
            if (next.has(requestId)) {
                next.delete(requestId);
            } else {
                next.add(requestId);
            }
            return next;
        });
    };

    if (isLoading && !result) {
        return (
            <section className="workspace-page review-requests-page">
                <DataStateBlock variant="loading" title="Loading review requests" description="Fetching request queue." />
            </section>
        );
    }

    if (error) {
        return (
            <section className="workspace-page review-requests-page">
                <DataStateBlock
                    variant="error"
                    title="Unable to load review requests"
                    description={error.message}
                    actionLabel="Retry"
                    onAction={() => refetch()}
                />
            </section>
        );
    }

    return (
        <section className="workspace-page review-requests-page">
            <WorkspacePageHeader
                title="Review Requests"
                description="Process submitted requests with a consistent desktop review flow."
                meta={meta.total ? `${meta.total} requests` : 'Request queue'}
            />

            <SearchInput
                value={filterContract.filters.search || ''}
                onChange={(value) => filterContract.setFilter('search', value)}
                onClear={() => filterContract.setFilter('search', '')}
                placeholder="Search by item, requester name or department..."
                isLoading={isFetching}
            />

            <DesktopFilterBar contract={filterContract}>
                <FilterSelect
                    label="Status"
                    value={panelFilters.status}
                    onChange={(value) => handlePanelFilterChange({ ...panelFilters, status: value })}
                    options={[
                        { value: 'IT_REVIEWED', label: 'IT Reviewed' },
                        { value: 'APPROVED', label: 'Approved' },
                        { value: 'REJECTED', label: 'Rejected' },
                        { value: 'ALREADY_PURCHASED', label: 'Already Purchased' }
                    ]}
                    placeholder="Submitted (Default)"
                />

                <FilterSelect
                    label="Priority"
                    value={panelFilters.priority}
                    onChange={(value) => handlePanelFilterChange({ ...panelFilters, priority: value })}
                    options={[
                        { value: 'LOW', label: 'Low' },
                        { value: 'MEDIUM', label: 'Medium' },
                        { value: 'HIGH', label: 'High' },
                        { value: 'URGENT', label: 'Urgent' }
                    ]}
                    placeholder="All Priorities"
                />

                <div className="request-filter-field">
                    <label className="filter-label" htmlFor="request-date-from">From Date</label>
                    <input
                        id="request-date-from"
                        type="date"
                        className="filter-select"
                        value={panelFilters.dateFrom}
                        onChange={(event) => handlePanelFilterChange({ ...panelFilters, dateFrom: event.target.value })}
                    />
                </div>

                <div className="request-filter-field">
                    <label className="filter-label" htmlFor="request-date-to">To Date</label>
                    <input
                        id="request-date-to"
                        type="date"
                        className="filter-select"
                        value={panelFilters.dateTo}
                        onChange={(event) => handlePanelFilterChange({ ...panelFilters, dateTo: event.target.value })}
                    />
                </div>
            </DesktopFilterBar>

            <BulkActionsBar selectedCount={selectedRequestIds.size}>
                <button
                    type="button"
                    className="workspace-inline-button is-primary"
                    onClick={() => {
                        const [firstSelected] = Array.from(selectedRequestIds);
                        if (firstSelected) {
                            setSelectedRequestId(firstSelected);
                        }
                    }}
                >
                    Review Selected
                </button>
                <button
                    type="button"
                    className="workspace-inline-button"
                    onClick={() => setSelectedRequestIds(new Set())}
                >
                    Clear Selection
                </button>
            </BulkActionsBar>

            {requests.length > 0 ? (
                <div className="workspace-table-container requests-table-container">
                    <table className="workspace-table requests-table" aria-label="Review requests table">
                        <thead>
                            <tr>
                                <th>
                                    <input
                                        type="checkbox"
                                        aria-label="Select all review requests"
                                        checked={requests.length > 0 && selectedRequestIds.size === requests.length}
                                        onChange={(event) => toggleSelectAll(event.target.checked)}
                                    />
                                </th>
                                <th>Item Name</th>
                                <th>Requester</th>
                                <th>Date</th>
                                <th>Priority</th>
                                <th>Invoice</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map((request) => (
                                <tr key={request.id} className={selectedRequestIds.has(request.id) ? 'workspace-table-row-selected' : ''}>
                                    <td data-label="Select">
                                        <input
                                            type="checkbox"
                                            aria-label={`Select request ${request.itemName}`}
                                            checked={selectedRequestIds.has(request.id)}
                                            onChange={() => toggleSelected(request.id)}
                                        />
                                    </td>
                                    <td data-label="Item Name" className="font-medium">{request.itemName}</td>
                                    <td data-label="Requester">
                                        <div>
                                            {request.requester?.ldapAttributes?.displayName || request.requester?.username}
                                            <div className="text-secondary">{request.requester?.ldapAttributes?.department}</div>
                                        </div>
                                    </td>
                                    <td data-label="Date">{new Date(request.createdAt).toLocaleDateString()}</td>
                                    <td data-label="Priority">
                                        {request.priority ? (
                                            <span className={priorityClass(request.priority)}>{request.priority}</span>
                                        ) : '-'}
                                    </td>
                                    <td data-label="Invoice">
                                        {request.invoiceFileUrl ? (
                                            <span className="invoice-indicator" title="Invoice attached" aria-label="Invoice attached">Yes</span>
                                        ) : (
                                            <span className="invoice-indicator-empty" aria-label="No invoice attached">-</span>
                                        )}
                                    </td>
                                    <td data-label="Status">
                                        <span className={statusClass(request.status)}>
                                            {request.status === 'ALREADY_PURCHASED' ? 'Purchased' : request.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td data-label="Actions">
                                        <button
                                            onClick={() => setSelectedRequestId(request.id)}
                                            className="workspace-inline-button is-primary"
                                            type="button"
                                        >
                                            Review
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : filterContract.filters.search || filterContract.hasActiveFilters ? (
                <SearchEmptyState searchTerm={filterContract.filters.search} onClear={filterContract.reset} />
            ) : (
                <DataStateBlock variant="empty" title="No requests found" description="No requests match your current review queue." />
            )}

            {meta && meta.totalPages > 1 ? (
                <div className="pagination">
                    <button
                        className="workspace-inline-button"
                        disabled={meta.page <= 1}
                        onClick={() => filterContract.setFilter('page', String(Number(meta.page) - 1))}
                        type="button"
                    >
                        Previous
                    </button>
                    <span>Page {meta.page} of {meta.totalPages}</span>
                    <button
                        className="workspace-inline-button"
                        disabled={meta.page >= meta.totalPages}
                        onClick={() => filterContract.setFilter('page', String(Number(meta.page) + 1))}
                        type="button"
                    >
                        Next
                    </button>
                </div>
            ) : null}

            {selectedRequestId ? (
                <RequestReviewModal
                    request={requests.find((entry) => entry.id === selectedRequestId)}
                    onClose={() => setSelectedRequestId(null)}
                />
            ) : null}
        </section>
    );
};

export default ReviewRequestsPage;
