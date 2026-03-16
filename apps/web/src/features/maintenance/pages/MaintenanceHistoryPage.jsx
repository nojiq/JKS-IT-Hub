import React, { useState } from 'react';
import { useMaintenanceHistory } from "../hooks/useMaintenance.js";
import MaintenanceHistoryList from "../components/MaintenanceHistoryList.jsx";
import "./MaintenanceSchedulePage.css";

const MaintenanceHistoryPage = () => {
    const [filters, setFilters] = useState({ page: 1, perPage: 20, deviceType: '' });
    const { data: result, isLoading, error } = useMaintenanceHistory(filters);

    if (isLoading) return <div>Loading history...</div>;
    if (error) return <div>Error loading history: {error.message}</div>;

    const { data: completions, meta } = result || {};
    const { page, totalPages } = meta || { page: 1, totalPages: 1 };

    const handlePageChange = (newPage) => {
        setFilters(prev => ({ ...prev, page: newPage }));
    };

    return (
        <div className="maintenance-schedule-page">
            <h1 style={{ marginBottom: '1.5rem' }}>My Maintenance History</h1>

            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label htmlFor="history-device-type-filter">Device Type:</label>
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

            <MaintenanceHistoryList completions={completions} />

            {totalPages > 1 && (
                <div className="pagination-controls" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                    <button
                        disabled={page <= 1}
                        onClick={() => handlePageChange(page - 1)}
                        className="btn-secondary"
                    >
                        Previous
                    </button>
                    <span style={{ alignSelf: 'center' }}>Page {page} of {totalPages}</span>
                    <button
                        disabled={page >= totalPages}
                        onClick={() => handlePageChange(page + 1)}
                        className="btn-secondary"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

export default MaintenanceHistoryPage;
