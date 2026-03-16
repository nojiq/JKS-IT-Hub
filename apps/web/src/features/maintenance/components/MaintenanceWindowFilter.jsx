
import React, { useState } from 'react';
import { useCycles } from "../../hooks/useMaintenance.js";
import './MaintenanceWindowFilter.css';

const MaintenanceWindowFilter = ({ filters, onFilterChange }) => {
    const { data: cycles } = useCycles(true);
    const [localFilters, setLocalFilters] = useState(filters);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setLocalFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onFilterChange(localFilters);
    };

    return (
        <div className="maintenance-filter">
            <form onSubmit={handleSubmit}>
                <div className="filter-grid">
                    <div className="form-group">
                        <label>Cycle</label>
                        <select
                            name="cycleId"
                            value={localFilters.cycleId || ''}
                            onChange={handleChange}
                            className="form-control"
                        >
                            <option value="">All Cycles</option>
                            {cycles?.map(cycle => (
                                <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Status</label>
                        <select
                            name="status"
                            value={localFilters.status || ''}
                            onChange={handleChange}
                            className="form-control"
                        >
                            <option value="">All Statuses</option>
                            <option value="SCHEDULED">Scheduled</option>
                            <option value="UPCOMING">Upcoming</option>
                            <option value="OVERDUE">Overdue</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELLED">Cancelled</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Device Type</label>
                        <select
                            name="deviceType"
                            value={localFilters.deviceType || ''}
                            onChange={handleChange}
                            className="form-control"
                        >
                            <option value="">All Types</option>
                            <option value="LAPTOP">Laptop</option>
                            <option value="DESKTOP_PC">Desktop PC</option>
                            <option value="SERVER">Server</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>From Date</label>
                        <input
                            type="date"
                            name="startDateFrom"
                            value={localFilters.startDateFrom || ''}
                            onChange={handleChange}
                            className="form-control"
                        />
                    </div>

                    <div className="form-group">
                        <label>To Date</label>
                        <input
                            type="date"
                            name="startDateTo"
                            value={localFilters.startDateTo || ''}
                            onChange={handleChange}
                            className="form-control"
                        />
                    </div>
                </div>
                <div className="filter-actions">
                    <button type="submit" className="btn-primary">Apply Filters</button>
                </div>
            </form>
        </div>
    );
};

export default MaintenanceWindowFilter;
