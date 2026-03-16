import { useEffect, useState } from 'react';
import { useAllRequests } from '../hooks/useRequests.js';
import AdminApprovalModal from '../components/AdminApprovalModal';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { FilterSelect } from '../../../shared/components/FilterPanel/FilterSelect';
import { SearchEmptyState } from '../../../shared/components/EmptyState/SearchEmptyState';
import { useSharedFilters } from '../../../shared/workspace/useSharedFilters';
import { WorkspacePageHeader } from '../../../shared/workspace/WorkspacePageHeader';
import { DesktopFilterBar } from '../../../shared/workspace/DesktopFilterBar';
import { BulkActionsBar } from '../../../shared/workspace/BulkActionsBar';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock';
import '../../../shared/workspace/workspace.css';
import './AdminApprovalPage.css';

const priorityClass = (priority) => `workspace-priority-badge priority-${String(priority || '').toLowerCase()}`;
const EMPTY_REQUESTS = [];

const AdminApprovalPage = () => {
    const filterContract = useSharedFilters({ page: '1', perPage: '20', status: 'IT_REVIEWED' });
    const { data: result, isLoading, error, isFetching, refetch } = useAllRequests(filterContract.filters);

    const [selectedRequestId, setSelectedRequestId] = useState(null);
    const [selectedRequestIds, setSelectedRequestIds] = useState(new Set());

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
            <section className="workspace-page admin-approval-page">
                <DataStateBlock variant="loading" title="Loading approvals" description="Fetching admin approval queue." />
            </section>
        );
    }

    if (error) {
        return (
            <section className="workspace-page admin-approval-page">
                <DataStateBlock
                    variant="error"
                    title="Unable to load approvals"
                    description={error.message}
                    actionLabel="Retry"
                    onAction={() => refetch()}
                />
            </section>
        );
    }

    return (
        <section className="workspace-page admin-approval-page">
            <WorkspacePageHeader
                title="Admin Approvals"
                description="Review and approve requests that have already passed IT review."
                meta={meta.total ? `${meta.total} pending approvals` : 'Approval queue'}
            />

            <SearchInput
                value={filterContract.filters.search || ''}
                onChange={(value) => filterContract.setFilter('search', value)}
                onClear={() => filterContract.setFilter('search', '')}
                placeholder="Search by item, requester, or category..."
                isLoading={isFetching}
            />

            <DesktopFilterBar contract={filterContract}>
                <FilterSelect
                    label="Status"
                    value={filterContract.filters.status}
                    onChange={(value) => filterContract.setFilter('status', value || 'IT_REVIEWED')}
                    options={[
                        { value: 'IT_REVIEWED', label: 'Ready for Approval' },
                        { value: 'APPROVED', label: 'Approved' },
                        { value: 'REJECTED', label: 'Rejected' }
                    ]}
                />

                <FilterSelect
                    label="Priority"
                    value={filterContract.filters.priority}
                    onChange={(value) => filterContract.setFilter('priority', value)}
                    options={[
                        { value: 'LOW', label: 'Low' },
                        { value: 'MEDIUM', label: 'Medium' },
                        { value: 'HIGH', label: 'High' },
                        { value: 'URGENT', label: 'Urgent' }
                    ]}
                    placeholder="All Priorities"
                />
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
                    <table className="workspace-table requests-table" aria-label="Admin approvals table">
                        <thead>
                            <tr>
                                <th>
                                    <input
                                        type="checkbox"
                                        aria-label="Select all approval requests"
                                        checked={requests.length > 0 && selectedRequestIds.size === requests.length}
                                        onChange={(event) => toggleSelectAll(event.target.checked)}
                                    />
                                </th>
                                <th>Item Name</th>
                                <th>Requester</th>
                                <th>IT Reviewer</th>
                                <th>Date</th>
                                <th>Priority</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map((request) => (
                                <tr key={request.id} className={selectedRequestIds.has(request.id) ? 'workspace-table-row-selected' : ''}>
                                    <td data-label="Select">
                                        <input
                                            type="checkbox"
                                            checked={selectedRequestIds.has(request.id)}
                                            onChange={() => toggleSelected(request.id)}
                                            aria-label={`Select request ${request.itemName}`}
                                        />
                                    </td>
                                    <td data-label="Item Name" className="font-medium">
                                        <div>
                                            {request.itemName}
                                            <div className="text-secondary">{request.category || 'Uncategorized'}</div>
                                        </div>
                                    </td>
                                    <td data-label="Requester">
                                        <div>
                                            {request.requester?.ldapAttributes?.displayName || request.requester?.username}
                                            <div className="text-secondary">{request.requester?.ldapAttributes?.department}</div>
                                        </div>
                                    </td>
                                    <td data-label="IT Reviewer">
                                        <div>
                                            {request.itReviewedBy?.ldapAttributes?.displayName || request.itReviewedBy?.username || 'Unknown'}
                                            <div className="text-secondary">{request.itReviewedAt ? new Date(request.itReviewedAt).toLocaleDateString() : '-'}</div>
                                        </div>
                                    </td>
                                    <td data-label="Date">{new Date(request.createdAt).toLocaleDateString()}</td>
                                    <td data-label="Priority">
                                        {request.priority ? (
                                            <span className={priorityClass(request.priority)}>{request.priority}</span>
                                        ) : '-'}
                                    </td>
                                    <td data-label="Actions">
                                        <button
                                            onClick={() => setSelectedRequestId(request.id)}
                                            className="workspace-inline-button is-primary"
                                            type="button"
                                        >
                                            Review &amp; Approve
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
                <DataStateBlock
                    variant="empty"
                    title="No pending approvals"
                    description="All reviewed requests are already resolved."
                />
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

            {selectedRequestId && requests ? (
                <AdminApprovalModal
                    request={requests.find((entry) => entry.id === selectedRequestId)}
                    onClose={() => setSelectedRequestId(null)}
                />
            ) : null}
        </section>
    );
};

export default AdminApprovalPage;
