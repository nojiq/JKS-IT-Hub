import { useId, useMemo, useState } from 'react';
import { useAssignmentMatrix } from '../hooks/useMaintenance.js';
import AssignPolicyModal from '../components/AssignPolicyModal.jsx';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock.jsx';
import { WorkspacePanel } from '../../../shared/workspace/WorkspacePanel.jsx';
import { useToast } from '../../../shared/hooks/useToast.js';
import { formatTechnician } from '../utils/maintenanceDisplay.js';
import { formatTaskDueLabel } from '../utils/taskUrgency.js';
import { formatDisplayDate } from '../../../shared/utils/date-format.js';
import '../../../shared/workspace/workspace.css';
import './MaintenanceAssignmentsPage.css';
import './MaintenanceHomePage.css';

const MaintenanceAssignmentsPage = () => {
    const toast = useToast();
    const assignmentsHintId = useId();
    const { data: rows = [], isLoading, error, refetch } = useAssignmentMatrix();
    const [selected, setSelected] = useState(() => new Set());
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignModalRows, setAssignModalRows] = useState([]);

    const selectedRows = useMemo(
        () => rows.filter((row) => selected.has(row.assetId)),
        [rows, selected]
    );
    const allSelected = rows.length > 0 && selectedRows.length === rows.length;

    const toggleRow = (assetId) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(assetId)) next.delete(assetId);
            else next.add(assetId);
            return next;
        });
    };

    const toggleAll = () => {
        if (allSelected) setSelected(new Set());
        else setSelected(new Set(rows.map((row) => row.assetId)));
    };

    const openAssignModal = (targetRows) => {
        const rowsToAssign = targetRows ?? selectedRows;
        if (rowsToAssign.length === 0) {
            toast.info(
                'Select assets first',
                'Use the checkboxes in the table, or Assign on a row, then choose Assign policy.'
            );
            return;
        }
        setAssignModalRows(rowsToAssign);
        setShowAssignModal(true);
    };

    if (isLoading) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock
                    variant="loading"
                    title="Loading assignments"
                    description="Listing assets, policies, and technicians."
                />
            </section>
        );
    }

    if (error) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock variant="error" title="Unable to load assignments" description={error.message} />
            </section>
        );
    }

    return (
        <div className="maintenance-module-page maintenance-assignments-page">
            <header className="maintenance-page-header">
                <div>
                    <h2>
                        <span className="workspace-panel-title-hint" tabIndex={0} aria-describedby={assignmentsHintId}>
                            Assignments
                            <span
                                className="workspace-panel-title-hint-popup"
                                id={assignmentsHintId}
                                role="tooltip"
                                aria-hidden="true"
                            >
                                Link each asset to a maintenance policy and technician. Scheduling runs automatically from policy intervals.
                            </span>
                        </span>
                    </h2>
                </div>
            </header>

            <WorkspacePanel
                variant="table"
                title="Asset assignments"
                meta={
                    selectedRows.length > 0
                        ? `${selectedRows.length} asset${selectedRows.length === 1 ? '' : 's'} selected`
                        : 'Select assets with the checkboxes, then assign a policy and technician.'
                }
                actions={
                    <button
                        type="button"
                        className={`workspace-inline-button is-primary${selectedRows.length === 0 ? ' is-muted' : ''}`}
                        aria-disabled={selectedRows.length === 0}
                        onClick={() => openAssignModal()}
                    >
                        Assign policy
                    </button>
                }
            >
                <div className="maintenance-table-container">
                    <table className="workspace-table maintenance-windows-table" aria-label="Maintenance assignments">
                        <thead>
                            <tr>
                                <th scope="col">
                                    <input
                                        type="checkbox"
                                        aria-label="Select all assets"
                                        checked={allSelected}
                                        onChange={toggleAll}
                                    />
                                </th>
                                <th>Asset tag</th>
                                <th>Device type</th>
                                <th>User name</th>
                                <th>Department</th>
                                <th>Technician</th>
                                <th>Active policy</th>
                                <th>Next due</th>
                                <th>Status</th>
                                <th scope="col" className="maintenance-assignments-actions-col">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="maintenance-table-empty">
                                        No assets synced yet. Sync assets before creating assignments.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row) => {
                                    const technician = formatTechnician(row.technician);
                                    const dueLabel = row.nextDueDate
                                        ? formatTaskDueLabel({
                                              status: row.status,
                                              dueDate: row.nextDueDate
                                          })
                                        : '—';
                                    return (
                                        <tr key={row.assetId}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Select ${row.assetTag}`}
                                                    checked={selected.has(row.assetId)}
                                                    onChange={() => toggleRow(row.assetId)}
                                                />
                                            </td>
                                            <td data-label="Asset tag">{row.assetTag}</td>
                                            <td data-label="Device type">{row.deviceType}</td>
                                            <td data-label="User name">{row.userName || '—'}</td>
                                            <td data-label="Department">{row.department || '—'}</td>
                                            <td data-label="Technician">{technician.primary}</td>
                                            <td data-label="Active policy">{row.profile?.name || '—'}</td>
                                            <td data-label="Next due">{dueLabel}</td>
                                            <td data-label="Status">
                                                <span className={`maintenance-status-badge ${String(row.status).toLowerCase()}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td data-label="Actions" className="maintenance-assignments-actions-col">
                                                <button
                                                    type="button"
                                                    className="workspace-inline-link"
                                                    onClick={() => openAssignModal([row])}
                                                >
                                                    Assign
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </WorkspacePanel>

            {showAssignModal ? (
                <AssignPolicyModal
                    rows={assignModalRows}
                    onClose={() => {
                        setShowAssignModal(false);
                        setAssignModalRows([]);
                    }}
                    onSuccess={() => {
                        setSelected(new Set());
                        setShowAssignModal(false);
                        setAssignModalRows([]);
                        refetch();
                    }}
                />
            ) : null}
        </div>
    );
};

export default MaintenanceAssignmentsPage;
