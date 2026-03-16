import React, { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMyRequests, useRequestDetails, requestsKeys } from '../hooks/useRequests.js';
import RequestListItem from '../components/RequestListItem.jsx';
import RequestDetailModal from '../components/RequestDetailModal.jsx';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSSE } from '../../../shared/hooks/useSSE.js';
import { useToast } from '../../../shared/hooks/useToast.js';

import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { FilterPanel } from '../../../shared/components/FilterPanel/FilterPanel';
import { FilterSelect } from '../../../shared/components/FilterPanel/FilterSelect';
import { useFilterParams } from '../../../shared/hooks/useFilterParams';
import { SearchEmptyState } from '../../../shared/components/EmptyState/SearchEmptyState';

const MyRequestsPage = () => {
    const navigate = useNavigate();
    const { id: routeRequestId } = useParams();
    const { filters, setFilter, clearFilters } = useFilterParams();

    // Ensure defaults for query
    const queryFilters = {
        ...filters,
        page: filters.page || 1,
        perPage: filters.perPage || 20
    };

    const { data: result, isLoading, error, isFetching } = useMyRequests(queryFilters);
    const queryClient = useQueryClient();
    const toast = useToast();

    const [selectedRequestId, setSelectedRequestId] = useState(null);
    const { data: selectedRequest, isLoading: isLoadingDetails } = useRequestDetails(selectedRequestId);

    useEffect(() => {
        if (routeRequestId) {
            setSelectedRequestId(routeRequestId);
        }
    }, [routeRequestId]);

    // ... (SSE Handlers kept same) ...
    // SSE Event Handlers - invalidate queries on real-time updates
    const handleRequestEvent = useCallback((data) => {
        // Invalidate my requests list to refetch
        queryClient.invalidateQueries({ queryKey: requestsKeys.all });

        // If viewing details for this request, invalidate detail query
        if (data.requestId && selectedRequestId === data.requestId) {
            queryClient.invalidateQueries({ queryKey: requestsKeys.detail(data.requestId) });
        }
    }, [queryClient, selectedRequestId]);

    // Handle status changed events with toast notifications
    const handleStatusChanged = useCallback((data) => {
        handleRequestEvent(data);

        // Show toast notification for approval/rejection
        if (data.newStatus === 'APPROVED') {
            toast.success('Request Approved', `Your request for "${data.itemName}" has been approved!`);
        } else if (data.newStatus === 'REJECTED' || data.newStatus === 'ALREADY_PURCHASED') {
            toast.warning('Request Update', `Your request was not approved`);
        } else if (data.newStatus === 'IT_REVIEWED') {
            toast.info('Request Reviewed', `Your request has been reviewed by IT`);
        }
    }, [handleRequestEvent, toast]);

    // Subscribe to request events
    useSSE('request.created', handleRequestEvent);
    useSSE('request.updated', handleRequestEvent);
    useSSE('request.status_changed', handleStatusChanged);

    const handleRequestClick = (id) => {
        setSelectedRequestId(id);
    };

    const handleCloseModal = () => {
        setSelectedRequestId(null);
        if (routeRequestId) {
            navigate('/requests/my-requests', { replace: true });
        }
    };

    // Allow rendering search UI even if loading (if no data)
    if (isLoading && !result) return <div className="loading">Loading requests...</div>;
    if (error) return <div className="error">Error loading requests: {error.message}</div>;

    const { data: requests, meta } = result || { data: [], meta: {} };
    const activeFiltersCount = Object.keys(filters).filter(k => k !== 'page' && k !== 'perPage').length;

    return (
        <div className="my-requests-page">
            <div className="page-header">
                <h1>My Requests</h1>
                <Link to="/requests/new" className="btn-primary">New Request</Link>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <SearchInput
                    value={filters.search || ''}
                    onChange={(val) => setFilter('search', val)}
                    onClear={() => setFilter('search', '')}
                    placeholder="Search requests..."
                    isLoading={isFetching}
                />

                <div style={{ marginTop: '1rem' }}>
                    <FilterPanel
                        activeCount={activeFiltersCount}
                        onClearAll={clearFilters}
                        title="Filter Requests"
                    >
                        <FilterSelect
                            label="Status"
                            value={filters.status}
                            onChange={(val) => setFilter('status', val)}
                            options={[
                                { value: 'SUBMITTED', label: 'Submitted' },
                                { value: 'IT_REVIEWED', label: 'IT Reviewed' },
                                { value: 'APPROVED', label: 'Approved' },
                                { value: 'REJECTED', label: 'Rejected' },
                                { value: 'ALREADY_PURCHASED', label: 'Already Purchased' }
                            ]}
                        />
                        <FilterSelect
                            label="Priority"
                            value={filters.priority}
                            onChange={(val) => setFilter('priority', val)}
                            options={[
                                { value: 'LOW', label: 'Low' },
                                { value: 'MEDIUM', label: 'Medium' },
                                { value: 'HIGH', label: 'High' },
                                { value: 'URGENT', label: 'Urgent' }
                            ]}
                        />
                    </FilterPanel>
                </div>
            </div>

            <div className="request-list">
                {requests && requests.length > 0 ? (
                    requests.map(req => (
                        <RequestListItem
                            key={req.id}
                            request={req}
                            onClick={handleRequestClick}
                        />
                    ))
                ) : (
                    <div style={{ marginTop: '2rem' }}>
                        {filters.search || activeFiltersCount > 0 ? (
                            <SearchEmptyState searchTerm={filters.search} onClear={clearFilters} />
                        ) : (
                            <div className="empty-state">
                                <p>No requests found.</p>
                                <Link to="/requests/new">Submit your first request</Link>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {meta && meta.totalPages > 1 && (
                <div className="pagination">
                    <button
                        disabled={meta.page <= 1}
                        onClick={() => setFilter('page', String(meta.page - 1))}
                    >
                        Previous
                    </button>
                    <span>Page {meta.page} of {meta.totalPages}</span>
                    <button
                        disabled={meta.page >= meta.totalPages}
                        onClick={() => setFilter('page', String(meta.page + 1))}
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Modal Logic */}
            {selectedRequestId && (
                <>
                    {isLoadingDetails && !selectedRequest && (
                        <div className="modal-backdrop-loading">
                            <div className="loading-spinner">Loading details...</div>
                        </div>
                    )}
                    {selectedRequest && (
                        <RequestDetailModal
                            request={selectedRequest}
                            isOpen={true}
                            onClose={handleCloseModal}
                        />
                    )}
                </>
            )}

            <style>{`
                .my-requests-page {
                    padding: 2rem;
                    max-width: 800px;
                    margin: 0 auto;
                }
                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }
                .page-header h1 {
                    margin: 0;
                }
                .btn-primary {
                    background-color: #4f46e5;
                    color: white;
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    text-decoration: none;
                    font-weight: 500;
                }
                .filters {
                    margin-bottom: 1.5rem;
                }
                .filters select {
                    padding: 0.5rem;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    min-width: 150px;
                }
                .loading, .error {
                    padding: 2rem;
                    text-align: center;
                    color: #6b7280;
                }
                .error { color: #dc2626; }
                .empty-state {
                    text-align: center;
                    padding: 3rem;
                    background-color: #f9fafb;
                    border-radius: 8px;
                    color: #6b7280;
                }
                .pagination {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 1rem;
                    margin-top: 2rem;
                }
                .pagination button {
                    padding: 0.25rem 0.75rem;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    background: white;
                    cursor: pointer;
                }
                .pagination button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .modal-backdrop-loading {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    color: white;
                    font-weight: 500;
                }
            `}</style>
        </div>
    );
};

export default MyRequestsPage;
