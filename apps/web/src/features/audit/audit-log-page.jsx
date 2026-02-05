import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { fetchSession } from "../users/auth-api.js";
import { fetchAuditLogs } from "./audit-api.js";

const formatTimestamp = (isoString) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);
};

const formatMetadata = (metadata) => {
    if (!metadata || typeof metadata !== 'object') return '—';

    const entries = Object.entries(metadata);
    if (entries.length === 0) return '—';

    return entries.map(([key, value]) => {
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return `${key}: ${displayValue}`;
    }).join(', ');
};

export default function AuditLogPage() {
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [filters, setFilters] = useState({
        action: '',
        actorId: '',
        startDate: '',
        endDate: ''
    });
    const [appliedFilters, setAppliedFilters] = useState({});

    const sessionQuery = useQuery({
        queryKey: ["session"],
        queryFn: fetchSession,
        retry: false,
        refetchOnWindowFocus: false
    });

    const auditLogsQuery = useQuery({
        queryKey: ["audit-logs", page, limit, appliedFilters],
        queryFn: () => fetchAuditLogs({ page, limit, ...appliedFilters }),
        enabled: Boolean(sessionQuery.data)
    });

    useEffect(() => {
        if (!sessionQuery.isLoading && sessionQuery.data === null) {
            navigate("/login", { replace: true });
        }
    }, [navigate, sessionQuery.data, sessionQuery.isLoading]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleApplyFilters = () => {
        const cleanFilters = {};
        Object.entries(filters).forEach(([key, value]) => {
            if (value && value.trim()) {
                cleanFilters[key] = value.trim();
            }
        });
        setAppliedFilters(cleanFilters);
        setPage(1); // Reset to first page when filters change
    };

    const handleClearFilters = () => {
        setFilters({
            action: '',
            actorId: '',
            startDate: '',
            endDate: ''
        });
        setAppliedFilters({});
        setPage(1);
    };

    const handlePreviousPage = () => {
        if (page > 1) setPage(prev => prev - 1);
    };

    const handleNextPage = () => {
        const totalPages = Math.ceil((auditLogsQuery.data?.meta?.total || 0) / limit);
        if (page < totalPages) setPage(prev => prev + 1);
    };

    if (sessionQuery.isLoading) {
        return <p className="status-text">Checking session…</p>;
    }

    if (sessionQuery.error) {
        return (
            <div className="status-block">
                <p className="status-text">Session check failed.</p>
                <p className="status-hint">Try refreshing or signing in again.</p>
            </div>
        );
    }

    if (!sessionQuery.data) {
        return null;
    }

    if (auditLogsQuery.isLoading) {
        return <p className="status-text">Loading audit logs…</p>;
    }

    if (auditLogsQuery.error) {
        return (
            <div className="status-block">
                <p className="status-text">Unable to load audit logs.</p>
                <p className="status-hint">{auditLogsQuery.error.message}</p>
            </div>
        );
    }

    const logs = auditLogsQuery.data?.data || [];
    const meta = auditLogsQuery.data?.meta || { total: 0, page: 1, limit: 20 };
    const totalPages = Math.ceil(meta.total / meta.limit);

    return (
        <section className="users-page audit-log-page">
            <header className="users-header">
                <div>
                    <p className="users-eyebrow">Transparency</p>
                    <h2>Audit Logs</h2>
                    <p className="users-subtitle">
                        Track all sensitive actions across the system.
                    </p>
                </div>
                <div className="users-header-actions">
                    <Link className="users-link" to="/">
                        Back to dashboard
                    </Link>
                </div>
            </header>

            {/* Filter Bar */}
            <div className="audit-filters">
                <div className="audit-filter-grid">
                    <div className="audit-filter-field">
                        <label className="audit-filter-label">Action</label>
                        <input
                            type="text"
                            className="audit-filter-input"
                            placeholder="e.g., user.status_change"
                            value={filters.action}
                            onChange={(e) => handleFilterChange('action', e.target.value)}
                        />
                    </div>

                    <div className="audit-filter-field">
                        <label className="audit-filter-label">Actor ID</label>
                        <input
                            type="text"
                            className="audit-filter-input"
                            placeholder="User ID"
                            value={filters.actorId}
                            onChange={(e) => handleFilterChange('actorId', e.target.value)}
                        />
                    </div>

                    <div className="audit-filter-field">
                        <label className="audit-filter-label">Start Date</label>
                        <input
                            type="datetime-local"
                            className="audit-filter-input"
                            value={filters.startDate}
                            onChange={(e) => handleFilterChange('startDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
                        />
                    </div>

                    <div className="audit-filter-field">
                        <label className="audit-filter-label">End Date</label>
                        <input
                            type="datetime-local"
                            className="audit-filter-input"
                            value={filters.endDate}
                            onChange={(e) => handleFilterChange('endDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
                        />
                    </div>
                </div>

                <div className="audit-filter-actions">
                    <button className="btn-primary" onClick={handleApplyFilters}>
                        Apply Filters
                    </button>
                    <button className="btn-secondary" onClick={handleClearFilters}>
                        Clear
                    </button>
                </div>
            </div>

            {/* Audit Logs Table */}
            {logs.length > 0 ? (
                <>
                    <div className="users-table-scroll">
                        <table className="users-table audit-table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Actor</th>
                                    <th>Action</th>
                                    <th>Target</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="audit-timestamp">
                                            {formatTimestamp(log.timestamp)}
                                        </td>
                                        <td>
                                            <div className="audit-actor">
                                                <span className="audit-actor-name">
                                                    {log.actor?.username || '—'}
                                                </span>
                                                <span className="audit-actor-meta">
                                                    {log.actor?.role || '—'} · {log.actor?.status || '—'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="audit-action">{log.action}</td>
                                        <td className="audit-target">{log.target || '—'}</td>
                                        <td className="audit-metadata">
                                            {formatMetadata(log.metadata)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="audit-pagination">
                        <div className="audit-pagination-info">
                            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, meta.total)} of {meta.total} entries
                        </div>
                        <div className="audit-pagination-controls">
                            <button
                                className="btn-secondary"
                                onClick={handlePreviousPage}
                                disabled={page === 1}
                            >
                                Previous
                            </button>
                            <span className="audit-pagination-page">
                                Page {page} of {totalPages || 1}
                            </span>
                            <button
                                className="btn-secondary"
                                onClick={handleNextPage}
                                disabled={page >= totalPages}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="users-empty">
                    <p className="status-text">No audit logs found.</p>
                    <p className="status-hint">
                        {Object.keys(appliedFilters).length > 0
                            ? 'Try adjusting your filters.'
                            : 'Audit logs will appear here as actions are performed.'}
                    </p>
                </div>
            )}
        </section>
    );
}
