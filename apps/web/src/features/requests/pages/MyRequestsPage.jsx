import React, { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    useMyPurchaseRecords,
    usePurchaseRecordDetails,
    purchaseRecordsKeys
} from "../hooks/useRequests.js";
import RequestListItem from "../components/RequestListItem.jsx";
import RequestDetailModal from "../components/RequestDetailModal.jsx";
import SubmitRequestModal from "../components/SubmitRequestModal.jsx";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSSE } from "../../../shared/hooks/useSSE.js";
import { useToast } from "../../../shared/hooks/useToast.js";
import { SearchInput } from "../../../shared/components/SearchInput/SearchInput";
import { FilterPanel } from "../../../shared/components/FilterPanel/FilterPanel";
import { FilterSelect } from "../../../shared/components/FilterPanel/FilterSelect";
import { useFilterParams } from "../../../shared/hooks/useFilterParams";
import { SearchEmptyState } from "../../../shared/components/EmptyState/SearchEmptyState";
import {
    APPROVAL_STATUS_OPTIONS,
    RECORD_STATUS_OPTIONS,
    deriveLegacyStatus
} from "../utils/purchaseRecordUtils.js";
import "./MyRequestsPage.css";

const MyRequestsPage = () => {
    const navigate = useNavigate();
    const { id: routeRecordId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { filters, setFilter, clearFilters } = useFilterParams();

    const queryFilters = {
        ...filters,
        page: filters.page || 1,
        perPage: filters.perPage || 20
    };

    const { data: result, isLoading, error, isFetching } = useMyPurchaseRecords(queryFilters);
    const queryClient = useQueryClient();
    const toast = useToast();

    const [selectedRecordId, setSelectedRecordId] = useState(null);
    const [submitModalOpen, setSubmitModalOpen] = useState(searchParams.get("submit") === "1");

    const { data: selectedRecord, isLoading: isLoadingDetails } = usePurchaseRecordDetails(selectedRecordId);

    useEffect(() => {
        if (routeRecordId) setSelectedRecordId(routeRecordId);
    }, [routeRecordId]);

    useEffect(() => {
        if (searchParams.get("submit") === "1") setSubmitModalOpen(true);
    }, [searchParams]);

    const clearSubmitQuery = () => {
        if (!searchParams.get("submit")) return;
        const next = new URLSearchParams(searchParams);
        next.delete("submit");
        setSearchParams(next, { replace: true });
    };

    const handleRequestEvent = useCallback((data) => {
        queryClient.invalidateQueries({ queryKey: purchaseRecordsKeys.all });
        if (data.requestId && selectedRecordId === data.requestId) {
            queryClient.invalidateQueries({ queryKey: purchaseRecordsKeys.detail(data.requestId) });
        }
    }, [queryClient, selectedRecordId]);

    const handleStatusChanged = useCallback((data) => {
        handleRequestEvent(data);
        const itemLabel = data.itemName || "your request";
        if (data.newStatus === "APPROVED") {
            toast.success("Request Approved", `Your request for "${itemLabel}" has been approved.`);
        } else if (data.newStatus === "REJECTED" || data.newStatus === "ALREADY_PURCHASED") {
            toast.warning("Request Update", "Your request status was updated.");
        } else if (data.newStatus === "IT_REVIEWED") {
            toast.info("Request Reviewed", "Your request has been reviewed by IT.");
        }
    }, [handleRequestEvent, toast]);

    useSSE("request.created", handleRequestEvent);
    useSSE("request.updated", handleRequestEvent);
    useSSE("request.status_changed", handleStatusChanged);

    const handleRecordClick = (id) => setSelectedRecordId(id);

    const handleCloseDetail = () => {
        setSelectedRecordId(null);
        if (routeRecordId) navigate("/requests/my-requests", { replace: true });
    };

    const handleCloseSubmit = () => {
        setSubmitModalOpen(false);
        clearSubmitQuery();
    };

    const handleSubmitSuccess = () => {
        queryClient.invalidateQueries({ queryKey: purchaseRecordsKeys.all });
    };

    if (isLoading && !result) {
        return <div className="my-purchase-records-page is-loading">Loading purchase records...</div>;
    }

    if (error) {
        return <div className="my-purchase-records-page is-error">Error loading records: {error.message}</div>;
    }

    const { data: records = [], meta = {} } = result || {};
    const activeFiltersCount = Object.keys(filters).filter((key) => key !== "page" && key !== "perPage").length;
    const pendingCount = records.filter((record) => deriveLegacyStatus(record) === "IT_REVIEWED").length;

    return (
        <div className="my-purchase-records-page">
            <section className="my-purchase-records-hero">
                <div className="my-purchase-records-hero__copy">
                    <p className="my-purchase-records-hero__eyebrow">Self service</p>
                    <h2>My Purchase Records</h2>
                    <p>Track submitted purchases, line items, and approval progress in one place.</p>
                </div>
                <div className="my-purchase-records-hero__stats">
                    <div>
                        <span>Total records</span>
                        <strong>{meta.total ?? records.length}</strong>
                    </div>
                    <div>
                        <span>In review</span>
                        <strong>{pendingCount}</strong>
                    </div>
                </div>
            </section>

            <div className="my-purchase-records-toolbar">
                <SearchInput
                    value={filters.search || ""}
                    onChange={(val) => setFilter("search", val)}
                    onClear={() => setFilter("search", "")}
                    placeholder="Search reason, item, category..."
                    isLoading={isFetching}
                />

                <FilterPanel
                    activeCount={activeFiltersCount}
                    onClearAll={clearFilters}
                    title="Filter records"
                >
                    <FilterSelect
                        label="Record status"
                        value={filters.recordStatus}
                        onChange={(val) => setFilter("recordStatus", val)}
                        options={RECORD_STATUS_OPTIONS}
                    />
                    <FilterSelect
                        label="Approval status"
                        value={filters.approvalStatus}
                        onChange={(val) => setFilter("approvalStatus", val)}
                        options={APPROVAL_STATUS_OPTIONS}
                    />
                </FilterPanel>
            </div>

            <div className="my-purchase-records-list">
                {records.length > 0 ? (
                    records.map((record) => (
                        <RequestListItem
                            key={record.id}
                            request={record}
                            onClick={handleRecordClick}
                        />
                    ))
                ) : (
                    <div className="my-purchase-records-empty">
                        {filters.search || activeFiltersCount > 0 ? (
                            <SearchEmptyState searchTerm={filters.search} onClear={clearFilters} />
                        ) : (
                            <>
                                <p>No purchase records yet.</p>
                                <button
                                    type="button"
                                    className="my-purchase-records-empty__cta"
                                    onClick={() => setSubmitModalOpen(true)}
                                >
                                    Submit your first request
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {meta.totalPages > 1 && (
                <div className="my-purchase-records-pagination">
                    <button
                        type="button"
                        disabled={meta.page <= 1}
                        onClick={() => setFilter("page", String(meta.page - 1))}
                    >
                        Previous
                    </button>
                    <span>Page {meta.page} of {meta.totalPages}</span>
                    <button
                        type="button"
                        disabled={meta.page >= meta.totalPages}
                        onClick={() => setFilter("page", String(meta.page + 1))}
                    >
                        Next
                    </button>
                </div>
            )}

            {selectedRecordId && (
                <>
                    {isLoadingDetails && !selectedRecord && (
                        <div className="my-purchase-records-modal-loading" role="status">
                            Loading details...
                        </div>
                    )}
                    {selectedRecord && (
                        <RequestDetailModal
                            request={selectedRecord}
                            isOpen
                            onClose={handleCloseDetail}
                        />
                    )}
                </>
            )}

            <SubmitRequestModal
                isOpen={submitModalOpen}
                onClose={handleCloseSubmit}
                onSuccess={handleSubmitSuccess}
            />
        </div>
    );
};

export default MyRequestsPage;
