import React, { useState } from 'react';
import { useMyMaintenanceWindows } from '../hooks/useMaintenance.js';
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

    if (isLoading && !result) return <div className="loading">Loading your maintenance tasks...</div>;
    if (error) return <div className="error-message">Error loading tasks: {error.message}</div>;

    const windows = result?.data || [];
    const meta = result?.meta || { page, totalPages: 1, total: windows.length };

    const upcomingCount = windows.filter((window) => window.status === 'UPCOMING').length;
    const scheduledCount = windows.filter((window) => window.status === 'SCHEDULED').length;
    const overdueCount = windows.filter((window) => window.status === 'OVERDUE').length;

    return (
        <div className="my-tasks-page">
            <div className="page-header">
                <h1>My Maintenance Tasks</h1>
                <p className="page-description">
                    View and manage maintenance windows assigned to you
                </p>
            </div>

            <div className="stats-summary">
                <div className="stat-card upcoming">
                    <div className="stat-value">{upcomingCount}</div>
                    <div className="stat-label">Upcoming</div>
                </div>
                <div className="stat-card scheduled">
                    <div className="stat-value">{scheduledCount}</div>
                    <div className="stat-label">Scheduled</div>
                </div>
                <div className="stat-card overdue">
                    <div className="stat-value">{overdueCount}</div>
                    <div className="stat-label">Overdue</div>
                </div>
            </div>

            <div className="filter-section">
                <label htmlFor="status-filter">Filter by Status:</label>
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

            {windows.length === 0 ? (
                <div className="empty-state">
                    {statusFilter === 'all'
                        ? 'No maintenance tasks assigned to you.'
                        : `No ${statusFilter} tasks found.`}
                </div>
            ) : (
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
            )}

            {meta.totalPages > 1 && (
                <div className="pagination-controls">
                    <button
                        type="button"
                        className="btn-secondary"
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
                        className="btn-secondary"
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
