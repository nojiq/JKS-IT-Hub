import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyMaintenanceWindows } from '../hooks/useMaintenance.js';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock.jsx';
import { WorkspacePanel } from '../../../shared/workspace/WorkspacePanel.jsx';
import { MaintenanceSearchCombobox } from '../components/MaintenanceSearchCombobox.jsx';
import MaintenanceWindowList from '../components/MaintenanceWindowList.jsx';
import { FilterSelect } from '../../../shared/components/FilterPanel/FilterSelect';
import './MaintenanceHomePage.css';
import './MyMaintenanceTasksPage.css';

const PAGE_SIZE = 20;

const MyMaintenanceTasksPage = () => {
    const navigate = useNavigate();
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');

    const statusQuery = statusFilter === 'all' ? undefined : statusFilter.toUpperCase();
    const { data: result, isLoading, error, isFetching } = useMyMaintenanceWindows({
        status: statusQuery,
        page,
        limit: PAGE_SIZE
    });

    const windows = result?.data || [];
    const meta = result?.meta || { page, totalPages: 1, total: windows.length };

    const filteredWindows = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return windows;
        return windows.filter((window) => {
            const haystack = [
                window.cycleConfig?.name,
                window.status,
                window.assignedTo?.displayName,
                window.assignedTo?.username,
                window.id
            ];
            return haystack.some((value) => String(value || '').toLowerCase().includes(query));
        });
    }, [windows, search]);

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

    const upcomingCount = windows.filter((window) => window.status === 'UPCOMING').length;
    const scheduledCount = windows.filter((window) => window.status === 'SCHEDULED').length;
    const overdueCount = windows.filter((window) => window.status === 'OVERDUE').length;

    return (
        <div className="maintenance-module-page my-tasks-page">
            <header className="maintenance-page-header">
                <div>
                    <h2>My maintenance tasks</h2>
                    <p>Assigned windows for your queue. Filter by status or search to find specific work.</p>
                </div>
            </header>

            <dl className="maintenance-summary-strip">
                <div className="maintenance-summary-item">
                    <dt>Upcoming</dt>
                    <dd>{upcomingCount}</dd>
                </div>
                <div className="maintenance-summary-item">
                    <dt>Scheduled</dt>
                    <dd>{scheduledCount}</dd>
                </div>
                <div className="maintenance-summary-item">
                    <dt>Overdue</dt>
                    <dd>{overdueCount}</dd>
                </div>
            </dl>

            <div className="maintenance-toolbar">
                <MaintenanceSearchCombobox
                    value={search}
                    onChange={setSearch}
                    windows={windows}
                    placeholder="Search assigned windows…"
                    isLoading={isFetching}
                />
                <FilterSelect
                    label="Status"
                    value={statusFilter === 'all' ? '' : statusFilter}
                    onChange={(value) => {
                        setStatusFilter(value || 'all');
                        setPage(1);
                    }}
                    options={[
                        { value: 'upcoming', label: 'Upcoming' },
                        { value: 'scheduled', label: 'Scheduled' },
                        { value: 'overdue', label: 'Overdue' },
                        { value: 'completed', label: 'Completed' }
                    ]}
                />
            </div>

            {filteredWindows.length === 0 ? (
                <WorkspacePanel variant="detail" title="Assigned windows" meta="No items match the current technician view.">
                    <p className="maintenance-empty-note">
                        {statusFilter === 'all' && !search
                            ? 'No maintenance tasks assigned to you.'
                            : 'No tasks match your current filters.'}
                    </p>
                </WorkspacePanel>
            ) : (
                <WorkspacePanel
                    variant="table"
                    title="Assigned windows"
                    meta={`${meta.total ?? filteredWindows.length} task${(meta.total ?? filteredWindows.length) === 1 ? '' : 's'} in the current queue`}
                >
                    <MaintenanceWindowList
                        windows={filteredWindows}
                        meta={{ ...meta, totalPages: 1 }}
                        dense
                        onView={(window) => navigate(`/maintenance/schedule/${window.id}`)}
                    />
                </WorkspacePanel>
            )}

            {meta.totalPages > 1 ? (
                <div className="maintenance-pagination-bar">
                    <p className="maintenance-pagination-summary">
                        Page {meta.page} of {meta.totalPages}
                    </p>
                    <div className="maintenance-pagination-controls">
                        <button
                            type="button"
                            className="workspace-inline-button"
                            disabled={meta.page <= 1 || isFetching}
                            onClick={() => setPage(meta.page - 1)}
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            className="workspace-inline-button"
                            disabled={meta.page >= meta.totalPages || isFetching}
                            onClick={() => setPage(meta.page + 1)}
                        >
                            Next
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default MyMaintenanceTasksPage;
