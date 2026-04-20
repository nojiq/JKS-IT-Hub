import React, { useState } from 'react';
import { useMyMaintenanceWindows } from '../hooks/useMaintenance.js';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock.jsx';
import { WorkspacePanel } from '../../../shared/workspace/WorkspacePanel.jsx';
import './MaintenanceHomePage.css';
import './MyMaintenanceTasksPage.css';

const PAGE_SIZE = 20;

const formatAssignmentReason = (reason) => {
    if (!reason) return null;
    if (reason === 'rotation') return 'Rotation';
    if (reason === 'fixed-assignment') return 'Fixed Assignment';
    if (reason === 'manual-override') return 'Manual Assignment';
    return reason;
};

const normalizeDeviceTypes = (deviceTypes = []) =>
    deviceTypes
        .map((item) => (typeof item === 'string' ? item : item?.deviceType))
        .filter(Boolean);

const MyMaintenanceTasksPage = () => {
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(1);

    const statusQuery = statusFilter === 'all' ? undefined : statusFilter.toUpperCase();
    const { data: result, isLoading, error, isFetching } = useMyMaintenanceWindows({
        status: statusQuery,
        page,
        limit: PAGE_SIZE
    });

    if (isLoading && !result) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock
                    variant="loading"
                    title="Loading maintenance tasks"
                    description="Preparing assigned windows and technician workload details."
                />
            </section>
        );
    }

    if (error) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock
                    variant="error"
                    title="Unable to load maintenance tasks"
                    description={error.message}
                />
            </section>
        );
    }

    const windows = result?.data || [];
    const meta = result?.meta || { page, totalPages: 1, total: windows.length };

    const upcomingCount = windows.filter((window) => window.status === 'UPCOMING').length;
    const scheduledCount = windows.filter((window) => window.status === 'SCHEDULED').length;
    const overdueCount = windows.filter((window) => window.status === 'OVERDUE').length;

    return (
        <div className="maintenance-module-page my-tasks-page">
            <div className="maintenance-panel-grid stats-summary">
                <WorkspacePanel variant="detail" title="Upcoming" meta="Assigned work that is arriving soon.">
                    <div className="stat-value">{upcomingCount}</div>
                </WorkspacePanel>
                <WorkspacePanel variant="detail" title="Scheduled" meta="Windows currently planned for execution.">
                    <div className="stat-value">{scheduledCount}</div>
                </WorkspacePanel>
                <WorkspacePanel variant="detail" title="Overdue" meta="Assigned work that needs immediate follow-up.">
                    <div className="stat-value">{overdueCount}</div>
                </WorkspacePanel>
            </div>

            <WorkspacePanel
                variant="content"
                title="Assigned Windows"
                meta="Filter your queue by status, then open window details to complete or verify work."
            >
                <div className="maintenance-select-group filter-section">
                    <label htmlFor="status-filter">Status</label>
                    <select
                        id="status-filter"
                        value={statusFilter}
                        onChange={(event) => {
                            setStatusFilter(event.target.value);
                            setPage(1);
                        }}
                        disabled={isFetching}
                    >
                        <option value="all">All Tasks</option>
                        <option value="upcoming">Upcoming</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="overdue">Overdue</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
            </WorkspacePanel>

            {windows.length === 0 ? (
                <WorkspacePanel variant="detail" title="Assigned Windows" meta="No items match the current technician view.">
                    <div className="empty-state">
                        {statusFilter === 'all'
                            ? 'No maintenance tasks assigned to you.'
                            : `No ${statusFilter} tasks found.`}
                    </div>
                </WorkspacePanel>
            ) : (
                <WorkspacePanel
                    variant="table"
                    title="Assigned Windows"
                    meta={`${meta.total ?? windows.length} task${(meta.total ?? windows.length) === 1 ? '' : 's'} in the current queue`}
                >
                    <div className="tasks-grid">
                    {windows.map((window) => {
                        const deviceTypes = normalizeDeviceTypes(window.deviceTypes);
                        return (
                            <div key={window.id} className={`task-card ${window.status.toLowerCase()}`}>
                                <div className="task-header">
                                    <h3>{window.cycleConfig?.name || 'Ad-hoc Maintenance'}</h3>
                                    <span className={`status-badge ${window.status.toLowerCase()}`}>
                                        {window.status}
                                    </span>
                                </div>

                                <div className="task-details">
                                    <div className="detail-row">
                                        <span className="detail-label">Scheduled:</span>
                                        <span className="detail-value">
                                            {new Date(window.scheduledStartDate).toLocaleString()}
                                        </span>
                                    </div>

                                    {window.scheduledEndDate && (
                                        <div className="detail-row">
                                            <span className="detail-label">End:</span>
                                            <span className="detail-value">
                                                {new Date(window.scheduledEndDate).toLocaleString()}
                                            </span>
                                        </div>
                                    )}

                                    {window.cycleConfig?.description && (
                                        <div className="detail-row">
                                            <span className="detail-label">Description:</span>
                                            <span className="detail-value">{window.cycleConfig.description}</span>
                                        </div>
                                    )}

                                    {window.assignedTo && (
                                        <div className="detail-row">
                                            <span className="detail-label">Assigned To:</span>
                                            <span className="detail-value">
                                                {window.assignedTo.displayName || window.assignedTo.username || 'Unknown'}
                                            </span>
                                        </div>
                                    )}

                                    {window.assignmentReason && (
                                        <div className="detail-row">
                                            <span className="detail-label">Assignment:</span>
                                            <span className={`assignment-reason ${window.assignmentReason.toLowerCase().replace('-', '_')}`}>
                                                {formatAssignmentReason(window.assignmentReason)}
                                            </span>
                                        </div>
                                    )}

                                    {window.assignmentTimestamp && (
                                        <div className="detail-row">
                                            <span className="detail-label">Assigned At:</span>
                                            <span className="detail-value">
                                                {new Date(window.assignmentTimestamp).toLocaleString()}
                                            </span>
                                        </div>
                                    )}

                                    {window.departmentId && (
                                        <div className="detail-row">
                                            <span className="detail-label">Department:</span>
                                            <span className="detail-value">{window.departmentId}</span>
                                        </div>
                                    )}

                                    {deviceTypes.length > 0 && (
                                        <div className="detail-row">
                                            <span className="detail-label">Device Types:</span>
                                            <div className="device-types">
                                                {deviceTypes.map((type, index) => (
                                                    <span key={`${type}-${index}`} className="device-badge">
                                                        {type.replace(/_/g, ' ')}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {(window.checklist || window.checklistSnapshot) && (
                                        <div className="detail-row">
                                            <span className="detail-label">Checklist:</span>
                                            <span className="detail-value">
                                                {window.checklistSnapshot?.name || window.checklist?.name}
                                                {window.checklistVersion ? ` (v${window.checklistVersion})` : ''}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="task-actions">
                                    {window.status === 'SCHEDULED' || window.status === 'UPCOMING' ? (
                                        <a href={`/maintenance/schedule/${window.id}`} className="btn-primary">
                                            View Details
                                        </a>
                                    ) : window.status === 'COMPLETED' ? (
                                        <span className="completed-label">✓ Completed</span>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                    </div>
                </WorkspacePanel>
            )}

            {meta.totalPages > 1 && (
                <div className="maintenance-module-pagination pagination-controls">
                    <button
                        type="button"
                        className="workspace-inline-button"
                        disabled={meta.page <= 1 || isFetching}
                        onClick={() => setPage(meta.page - 1)}
                    >
                        Previous
                    </button>
                    <span>
                        Page {meta.page} of {meta.totalPages}
                    </span>
                    <button
                        type="button"
                        className="workspace-inline-button"
                        disabled={meta.page >= meta.totalPages || isFetching}
                        onClick={() => setPage(meta.page + 1)}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

export default MyMaintenanceTasksPage;
