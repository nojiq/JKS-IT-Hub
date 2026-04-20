import React, { useState } from 'react';
import { useMaintenanceHistory } from "../hooks/useMaintenance.js";
import MaintenanceHistoryList from "../components/MaintenanceHistoryList.jsx";
import { DataStateBlock } from "../../../shared/workspace/DataStateBlock.jsx";
import { WorkspacePanel } from "../../../shared/workspace/WorkspacePanel.jsx";
import "./MaintenanceHomePage.css";
import "./MaintenanceSchedulePage.css";

const MaintenanceHistoryPage = () => {
    const [filters, setFilters] = useState({ page: 1, perPage: 20, deviceType: '' });
    const { data: result, isLoading, error } = useMaintenanceHistory(filters);

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

    const { data: completions, meta } = result || {};
    const { page, totalPages } = meta || { page: 1, totalPages: 1 };

    const handlePageChange = (newPage) => {
        setFilters(prev => ({ ...prev, page: newPage }));
    };

    return (
        <div className="maintenance-module-page maintenance-schedule-page">
            <WorkspacePanel
                variant="content"
                title="Maintenance History"
                meta="Review completed windows, sign-off methods, and checklist snapshots."
            >
                <div className="maintenance-select-group">
                    <label htmlFor="history-device-type-filter">Device Type</label>
                    <select
                        id="history-device-type-filter"
                        value={filters.deviceType}
                        onChange={(event) =>
                            setFilters((prev) => ({
                                ...prev,
                                page: 1,
                                deviceType: event.target.value
                            }))
                        }
                    >
                        <option value="">All Types</option>
                        <option value="LAPTOP">Laptop</option>
                        <option value="DESKTOP_PC">Desktop PC</option>
                        <option value="SERVER">Server</option>
                    </select>
                </div>
            </WorkspacePanel>

            <WorkspacePanel
                variant="table"
                title="Completed Records"
                meta={`${meta?.total ?? completions?.length ?? 0} maintenance record${(meta?.total ?? completions?.length ?? 0) === 1 ? '' : 's'}`}
            >
                <MaintenanceHistoryList completions={completions} />

                {totalPages > 1 && (
                    <div className="maintenance-module-pagination">
                        <button
                            disabled={page <= 1}
                            onClick={() => handlePageChange(page - 1)}
                            className="workspace-inline-button"
                            type="button"
                        >
                            Previous
                        </button>
                        <span>Page {page} of {totalPages}</span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => handlePageChange(page + 1)}
                            className="workspace-inline-button"
                            type="button"
                        >
                            Next
                        </button>
                    </div>
                )}
            </WorkspacePanel>
        </div>
    );
};

export default MaintenanceHistoryPage;
