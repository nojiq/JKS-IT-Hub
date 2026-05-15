
import React from 'react';
import { formatCycleLabel } from '../utils/maintenanceDisplay.js';
import './CycleConfigList.css';

const CycleConfigList = ({ cycles = [], onEdit, onGenerateSchedule }) => {
    if (!cycles || cycles.length === 0) {
        return <div className="cycle-list-empty">No maintenance cycles found.</div>;
    }

    return (
        <table className="workspace-table cycle-list-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Interval (Months)</th>
                    <th>Default Checklist</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {cycles.map(cycle => {
                    const cycleLabel = formatCycleLabel(cycle.name, 'Cycle');
                    return (
                    <tr key={cycle.id}>
                        <td>
                            <span className="maintenance-table-primary">{cycleLabel.primary}</span>
                            {cycleLabel.secondary ? (
                                <code className="maintenance-table-secondary">{cycleLabel.secondary}</code>
                            ) : null}
                        </td>
                        <td>{cycle.intervalMonths}</td>
                        <td>
                            {cycle.defaultChecklist?.name
                                ? `${cycle.defaultChecklist.name} (${cycle.defaultChecklist.itemCount ?? cycle.defaultChecklist._count?.items ?? 0} items)`
                                : 'None'}
                        </td>
                        <td>{cycle.description}</td>
                        <td>
                            <span className={`status-badge ${cycle.isActive ? 'active' : 'inactive'}`}>
                                {cycle.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>
                            <button onClick={() => onEdit(cycle)} className="btn-secondary">Edit</button>
                            {onGenerateSchedule && cycle.isActive && (
                                <button
                                    onClick={() => onGenerateSchedule(cycle)}
                                    className="btn-primary"
                                    style={{ marginLeft: '0.5rem' }}
                                >
                                    Generate Schedule
                                </button>
                            )}
                        </td>
                    </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

export default CycleConfigList;
