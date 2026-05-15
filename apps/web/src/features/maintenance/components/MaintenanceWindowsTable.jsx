import DeviceTypeBadge from './DeviceTypeBadge.jsx';
import { MaintenanceRowActions } from './MaintenanceRowActions.jsx';
import { formatDisplayDateTime } from '../../../shared/utils/date-format.js';
import {
    formatAssignee,
    formatCycleLabel,
    formatWindowTitle
} from '../utils/maintenanceDisplay.js';

const statusClassName = (status) => String(status || '').toLowerCase();

const formatScheduleRange = (start, end) => {
    const startLabel = formatDisplayDateTime(start, { fallback: '-' });
    const endLabel = formatDisplayDateTime(end, { fallback: '' });
    if (!endLabel || endLabel === '-') {
        return startLabel;
    }
    return `${startLabel} → ${endLabel}`;
};

const assignmentReasonLabel = (reason) => {
    if (reason === 'rotation') return 'Rotation';
    if (reason === 'fixed-assignment') return 'Fixed';
    if (reason === 'manual-override') return 'Manual';
    return null;
};

export function MaintenanceWindowsTable({
    windows = [],
    dense = false,
    highlightedWindowId = null,
    onView,
    onEdit,
    onCancel,
    onSignOff,
    onAssign,
    ariaLabel = 'Maintenance windows'
}) {
    if (!windows.length) {
        return <div className="maintenance-table-empty">No maintenance windows found.</div>;
    }

    const showAssignee = !dense || Boolean(onAssign);
    const showDeviceTypes = !dense;

    return (
        <div className={`maintenance-table-container${dense ? ' is-dense' : ''}`}>
            <table className="workspace-table maintenance-windows-table" aria-label={ariaLabel}>
                <thead>
                    <tr>
                        <th>Window</th>
                        {!dense ? <th>Cycle</th> : null}
                        <th>Schedule</th>
                        <th>Status</th>
                        {showAssignee ? <th>Assignee</th> : null}
                        {showDeviceTypes ? <th>Devices</th> : null}
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {windows.map((window) => {
                        const title = formatWindowTitle(window);
                        const cycle = formatCycleLabel(window.cycleConfig?.name, 'Ad-hoc');
                        const assignee = formatAssignee(window.assignedTo);
                        const reason = assignmentReasonLabel(window.assignmentReason);
                        const isHighlighted = highlightedWindowId === window.id;

                        return (
                            <tr
                                key={window.id}
                                id={window.id ? `maintenance-window-${window.id}` : undefined}
                                className={isHighlighted ? 'workspace-table-row-selected' : undefined}
                                data-window-id={window.id}
                            >
                                <td data-label="Window">
                                    <div className="maintenance-table-primary-cell">
                                        <span className="maintenance-table-primary">{title.primary}</span>
                                        {title.secondary ? (
                                            <code className="maintenance-table-secondary">{title.secondary}</code>
                                        ) : null}
                                    </div>
                                </td>
                                {!dense ? (
                                    <td data-label="Cycle">
                                        <span className="maintenance-table-primary">{cycle.primary}</span>
                                        {cycle.secondary ? (
                                            <code className="maintenance-table-secondary">{cycle.secondary}</code>
                                        ) : null}
                                    </td>
                                ) : null}
                                <td data-label="Schedule">
                                    {formatScheduleRange(window.scheduledStartDate, window.scheduledEndDate)}
                                </td>
                                <td data-label="Status">
                                    <span className={`maintenance-status-badge ${statusClassName(window.status)}`}>
                                        {window.status}
                                    </span>
                                </td>
                                {showAssignee ? (
                                    <td data-label="Assignee">
                                        <span className="maintenance-table-primary">{assignee.primary}</span>
                                        {reason ? (
                                            <span className="maintenance-table-chip">{reason}</span>
                                        ) : null}
                                        {assignee.secondary ? (
                                            <code className="maintenance-table-secondary">{assignee.secondary}</code>
                                        ) : null}
                                    </td>
                                ) : null}
                                {showDeviceTypes ? (
                                    <td data-label="Devices">
                                        <DeviceTypeBadge deviceTypes={window.deviceTypes} showCount />
                                    </td>
                                ) : null}
                                <td data-label="Actions">
                                    <MaintenanceRowActions
                                        window={window}
                                        onView={onView}
                                        onEdit={onEdit}
                                        onCancel={onCancel}
                                        onSignOff={onSignOff}
                                        onAssign={onAssign}
                                        compact={dense}
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
