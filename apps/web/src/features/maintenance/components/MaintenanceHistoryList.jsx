import React from 'react';
import './MaintenanceWindowList.css';
import DeviceTypeBadge from './DeviceTypeBadge.jsx';
import { formatDisplayDateTime } from '../../../shared/utils/date-format.js';
import { formatCycleLabel } from '../utils/maintenanceDisplay.js';

const formatSignoffMode = (mode) => (mode === 'ASSISTED' ? 'Assisted' : 'Standard');

const MaintenanceHistoryList = ({ completions }) => {
    if (!completions || completions.length === 0) {
        return <div className="maintenance-table-empty">No maintenance history found.</div>;
    }

    return (
        <div className="maintenance-table-container">
            <table className="workspace-table maintenance-history-table" aria-label="Maintenance history">
                <thead>
                    <tr>
                        <th>Completed</th>
                        <th>Cycle</th>
                        <th>Signed by</th>
                        <th>Mode</th>
                        <th>Device types</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {completions.map((record) => {
                        const completionDeviceTypes = Array.isArray(record.deviceTypes) ? record.deviceTypes : [];
                        const windowDeviceTypes = Array.isArray(record.window?.deviceTypes) ? record.window.deviceTypes : [];
                        const deviceTypes = completionDeviceTypes.length > 0 ? completionDeviceTypes : windowDeviceTypes;
                        const cycle = formatCycleLabel(record.window?.cycleConfig?.name, 'N/A');

                        return (
                            <tr key={record.id}>
                                <td data-label="Completed">
                                    {formatDisplayDateTime(record.completedAt, { fallback: '-' })}
                                </td>
                                <td data-label="Cycle">
                                    <span className="maintenance-table-primary">{cycle.primary}</span>
                                    {cycle.secondary ? (
                                        <code className="maintenance-table-secondary">{cycle.secondary}</code>
                                    ) : null}
                                </td>
                                <td data-label="Signed by">{record.completedBy?.username || 'Unknown'}</td>
                                <td data-label="Mode">{formatSignoffMode(record.signoffMode || 'STANDARD')}</td>
                                <td data-label="Device types">
                                    <DeviceTypeBadge deviceTypes={deviceTypes} showCount />
                                </td>
                                <td data-label="Notes">{record.notes || '-'}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default MaintenanceHistoryList;
