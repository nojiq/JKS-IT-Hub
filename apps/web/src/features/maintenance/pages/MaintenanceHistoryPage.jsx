import { useId, useMemo, useState } from 'react';
import { useMaintenanceRunHistory } from '../hooks/useMaintenance.js';
import MaintenanceTaskDrawer from '../components/MaintenanceTaskDrawer.jsx';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock.jsx';
import { WorkspacePanel } from '../../../shared/workspace/WorkspacePanel.jsx';
import { formatTechnician } from '../utils/maintenanceDisplay.js';
import { formatTaskAssetLabel, formatTaskPolicyLabel } from '../utils/taskUrgency.js';
import { formatDisplayDate } from '../../../shared/utils/date-format.js';
import '../../../shared/workspace/workspace.css';
import './MaintenanceHomePage.css';

const MaintenanceHistoryPage = () => {
    const historyHintId = useId();
    const [filters, setFilters] = useState({ page: 1, perPage: 20, search: '' });
    const [auditRun, setAuditRun] = useState(null);

    const { data: result, isLoading, error, isFetching } = useMaintenanceRunHistory(filters);
    const runs = result?.data || [];
    const meta = result?.meta || { page: 1, totalPages: 1 };

    const filteredRuns = useMemo(() => {
        const query = String(filters.search || '').trim().toLowerCase();
        if (!query) return runs;
        return runs.filter((run) => {
            const asset = formatTaskAssetLabel(run).toLowerCase();
            const policy = formatTaskPolicyLabel(run).toLowerCase();
            const tech = run.assignedTo?.username?.toLowerCase() || '';
            return [asset, policy, tech, run.status].some((v) => v.includes(query));
        });
    }, [runs, filters.search]);

    if (isLoading) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock variant="loading" title="Loading history" description="Gathering completed maintenance runs." />
            </section>
        );
    }

    if (error) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock variant="error" title="Unable to load history" description={error.message} />
            </section>
        );
    }

    return (
        <div className="maintenance-module-page maintenance-history-page">
            <header className="maintenance-page-header">
                <div>
                    <h2>
                        <span className="workspace-panel-title-hint" tabIndex={0} aria-describedby={historyHintId}>
                            History
                            <span
                                className="workspace-panel-title-hint-popup"
                                id={historyHintId}
                                role="tooltip"
                                aria-hidden="true"
                            >
                                Audit trail of completed, skipped, or cancelled maintenance runs.
                            </span>
                        </span>
                    </h2>
                </div>
            </header>

            <motionlessHistoryToolbar filters={filters} setFilters={setFilters} isFetching={isFetching} />

            <WorkspacePanel
                variant="table"
                title="Maintenance audit log"
                meta={`${meta.total ?? filteredRuns.length} record${(meta.total ?? filteredRuns.length) === 1 ? '' : 's'}`}
            >
                <div className="maintenance-table-container">
                    <table className="workspace-table maintenance-windows-table" aria-label="Maintenance history">
                        <thead>
                            <tr>
                                <th>Completed</th>
                                <th>Asset</th>
                                <th>Policy</th>
                                <th>Technician</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRuns.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="maintenance-table-empty">
                                        No maintenance records match your filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredRuns.map((run) => {
                                    const tech = formatTechnician(run.assignedTo);
                                    return (
                                        <tr key={run.id}>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="workspace-inline-link history-run-link"
                                                    onClick={() => setAuditRun(run)}
                                                >
                                                    {formatDisplayDate(run.completedAt || run.dueDate, {
                                                        fallback: '—'
                                                    })}
                                                </button>
                                            </td>
                                            <td>{formatTaskAssetLabel(run)}</td>
                                            <td>{formatTaskPolicyLabel(run)}</td>
                                            <td>{tech.primary}</td>
                                            <td>
                                                <span className={`maintenance-status-badge ${run.status}`}>
                                                    {run.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {meta.totalPages > 1 ? (
                    <div className="maintenance-pagination-bar">
                        <p className="maintenance-pagination-summary">
                            Page {meta.page} of {meta.totalPages}
                        </p>
                        <motionlessPagination filters={filters} setFilters={setFilters} meta={meta} />
                    </div>
                ) : null}
            </WorkspacePanel>

            {auditRun ? (
                <MaintenanceTaskDrawer task={auditRun} readOnly onClose={() => setAuditRun(null)} />
            ) : null}
        </div>
    );
};

function motionlessHistoryToolbar({ filters, setFilters, isFetching }) {
    return (
        <div className="maintenance-toolbar">
            <label className="filter-item">
                <span className="filter-label">Search</span>
                <input
                    type="search"
                    value={filters.search}
                    placeholder="Asset, policy, technician…"
                    onChange={(e) => setFilters((p) => ({ ...p, page: 1, search: e.target.value }))}
                />
            </label>
            {isFetching ? <span className="maintenance-muted">Refreshing…</span> : null}
        </div>
    );
}

function motionlessPagination({ filters, setFilters, meta }) {
    return (
        <div className="maintenance-pagination-controls">
            <button
                type="button"
                className="workspace-inline-button"
                disabled={meta.page <= 1}
                onClick={() => setFilters((p) => ({ ...p, page: meta.page - 1 }))}
            >
                Previous
            </button>
            <button
                type="button"
                className="workspace-inline-button"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setFilters((p) => ({ ...p, page: meta.page + 1 }))}
            >
                Next
            </button>
        </div>
    );
}

export default MaintenanceHistoryPage;
