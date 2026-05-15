import React, { useMemo, useState } from 'react';
import { useMaintenanceHistory } from '../hooks/useMaintenance.js';
import MaintenanceHistoryList from '../components/MaintenanceHistoryList.jsx';
import { MaintenanceSearchCombobox } from '../components/MaintenanceSearchCombobox.jsx';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock.jsx';
import { WorkspacePanel } from '../../../shared/workspace/WorkspacePanel.jsx';
import { FilterSelect } from '../../../shared/components/FilterPanel/FilterSelect';
import './MaintenanceHomePage.css';

const MaintenanceHistoryPage = () => {
    const [filters, setFilters] = useState({ page: 1, perPage: 20, deviceType: '', search: '' });
    const { data: result, isLoading, error, isFetching } = useMaintenanceHistory(filters);

    const completions = result?.data || [];
    const meta = result?.meta || { page: 1, totalPages: 1 };

    const historyWindows = useMemo(
        () => completions.map((entry) => entry.window).filter(Boolean),
        [completions]
    );

    const filteredCompletions = useMemo(() => {
        const query = String(filters.search || '').trim().toLowerCase();
        if (!query) return completions;
        return completions.filter((record) => {
            const cycleName = record.window?.cycleConfig?.name || '';
            return [cycleName, record.completedBy?.username, record.notes]
                .some((value) => String(value || '').toLowerCase().includes(query));
        });
    }, [completions, filters.search]);

    if (isLoading) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock
                    variant="loading"
                    title="Loading maintenance history"
                    description="Preparing sign-off history and completed work records."
                />
            </section>
        );
    }

    if (error) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock
                    variant="error"
                    title="Unable to load maintenance history"
                    description={error.message}
                />
            </section>
        );
    }

    const { page, totalPages } = meta;

    const handlePageChange = (newPage) => {
        setFilters((prev) => ({ ...prev, page: newPage }));
    };

    return (
        <div className="maintenance-module-page maintenance-schedule-page">
            <header className="maintenance-page-header">
                <div>
                    <h2>Maintenance history</h2>
                    <p>Review completed windows, sign-off methods, and checklist snapshots.</p>
                </div>
            </header>

            <div className="maintenance-toolbar">
                <MaintenanceSearchCombobox
                    value={filters.search || ''}
                    onChange={(value) => setFilters((prev) => ({ ...prev, page: 1, search: value }))}
                    windows={historyWindows}
                    placeholder="Search completed records…"
                    isLoading={isFetching}
                />
                <FilterSelect
                    label="Device type"
                    value={filters.deviceType}
                    onChange={(value) => setFilters((prev) => ({ ...prev, page: 1, deviceType: value }))}
                    options={[
                        { value: 'LAPTOP', label: 'Laptop' },
                        { value: 'DESKTOP_PC', label: 'Desktop PC' },
                        { value: 'SERVER', label: 'Server' }
                    ]}
                />
            </div>

            <WorkspacePanel
                variant="table"
                title="Completed records"
                meta={`${meta?.total ?? filteredCompletions.length} maintenance record${(meta?.total ?? filteredCompletions.length) === 1 ? '' : 's'}`}
            >
                <MaintenanceHistoryList completions={filteredCompletions} />

                {totalPages > 1 ? (
                    <div className="maintenance-pagination-bar">
                        <p className="maintenance-pagination-summary">Page {page} of {totalPages}</p>
                        <div className="maintenance-pagination-controls">
                            <button
                                type="button"
                                className="workspace-inline-button"
                                disabled={page <= 1}
                                onClick={() => handlePageChange(page - 1)}
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                className="workspace-inline-button"
                                disabled={page >= totalPages}
                                onClick={() => handlePageChange(page + 1)}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                ) : null}
            </WorkspacePanel>
        </div>
    );
};

export default MaintenanceHistoryPage;
