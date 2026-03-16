import React from 'react';
import DeviceTypeBadge from "./DeviceTypeBadge.jsx";
import './MaintenanceWindowCard.css';

const statusClassName = (status) => String(status || '').toLowerCase();

const assignmentReasonLabel = (reason) => {
    if (reason === 'rotation') return 'Rotation';
    if (reason === 'fixed-assignment') return 'Fixed';
    if (reason === 'manual-override') return 'Manual';
    return null;
};

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
};

const formatDurationHours = (startValue, endValue) => {
    if (!startValue || !endValue) return '-';
    const start = new Date(startValue);
    const end = new Date(endValue);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-';
    return `${((end - start) / (1000 * 60 * 60)).toFixed(1)}h`;
};

const MaintenanceWindowCard = ({ window, onView, onEdit, onCancel, onSignOff, onAssign }) => {
    const assignmentLabel = assignmentReasonLabel(window.assignmentReason);
    const isTerminalStatus = window.status === 'CANCELLED' || window.status === 'COMPLETED';

    return (
        <article className="maintenance-window-card">
            <header className="maintenance-window-card__header">
                <h3 className="maintenance-window-card__title">{window.cycleConfig?.name || 'Ad-hoc'}</h3>
                <span className={`status-badge ${statusClassName(window.status)}`}>{window.status}</span>
            </header>

            <div className="maintenance-window-card__meta">
                <p><strong>Scheduled:</strong> {formatDateTime(window.scheduledStartDate)}</p>
                <p><strong>End:</strong> {formatDateTime(window.scheduledEndDate)}</p>
                <p><strong>Duration:</strong> {formatDurationHours(window.scheduledStartDate, window.scheduledEndDate)}</p>
                <p><strong>Device Types:</strong> <DeviceTypeBadge deviceTypes={window.deviceTypes} showCount /></p>
                <p>
                    <strong>Assigned To:</strong>{' '}
                    {window.assignedTo
                        ? (window.assignedTo.displayName || window.assignedTo.username || 'Unknown')
                        : 'Unassigned'}
                    {assignmentLabel ? ` (${assignmentLabel})` : ''}
                </p>
            </div>

            <div className="maintenance-window-card__actions">
                <button type="button" className="btn-secondary" onClick={() => onView?.(window)}>
                    View Details
                </button>

                {!isTerminalStatus && (
                    <>
                        {onSignOff && (
                            <button type="button" className="btn-primary" onClick={() => onSignOff(window)}>
                                Sign-Off
                            </button>
                        )}
                        {onAssign && (
                            <button type="button" className="btn-tertiary" onClick={() => onAssign(window)}>
                                {window.assignedTo ? 'Reassign' : 'Assign'}
                            </button>
                        )}
                        {onEdit && (
                            <button type="button" className="btn-secondary" onClick={() => onEdit(window)}>
                                Edit
                            </button>
                        )}
                        {onCancel && (
                            <button type="button" className="btn-danger" onClick={() => onCancel(window)}>
                                Cancel
                            </button>
                        )}
                    </>
                )}
            </div>
        </article>
    );
};

export default MaintenanceWindowCard;
