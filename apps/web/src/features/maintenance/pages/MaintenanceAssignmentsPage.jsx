import { useId, useMemo, useState } from 'react';
import { useAssignmentMatrix } from '../hooks/useMaintenance.js';
import AssignPolicyModal from '../components/AssignPolicyModal.jsx';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock.jsx';
import { WorkspacePanel } from '../../../shared/workspace/WorkspacePanel.jsx';
import { useToast } from '../../../shared/hooks/useToast.js';
import { formatTechnician } from '../utils/maintenanceDisplay.js';
import { formatTaskDueLabel } from '../utils/taskUrgency.js';
import '../../../shared/workspace/workspace.css';
import './MaintenanceAssignmentsPage.css';
import './MaintenanceHomePage.css';

const ALL_FILTER_VALUE = 'all';

const normalize = (value) => String(value || '').trim().toLowerCase();

const uniqueOptions = (rows, getValue) => {
    return Array.from(
        new Set(rows.map(getValue).map((value) => String(value || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
};

const MaintenanceAssignmentsPage = () => {
    const toast = useToast();
    const assignmentsHintId = useId();
    const searchInputId = useId();
    const statusFilterId = useId();
    const deviceTypeFilterId = useId();
    const departmentFilterId = useId();
    const technicianFilterId = useId();
    const policyFilterId = useId();
    const { data: rows = [], isLoading, error, refetch } = useAssignmentMatrix();
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({
        status: ALL_FILTER_VALUE,
        deviceType: ALL_FILTER_VALUE,
        department: ALL_FILTER_VALUE,
        technician: ALL_FILTER_VALUE,
        policy: ALL_FILTER_VALUE
    });
    const [selected, setSelected] = useState(() => new Set());
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignModalRows, setAssignModalRows] = useState([]);

    const rowsWithDisplay = useMemo(
        () =>
            rows.map((row) => {
                const technician = formatTechnician(row.technician);
                const technicianLabel = technician.primary || 'Unassigned';
                return {
                    ...row,
                    technicianDisplay: technician,
                    technicianFilterValue: technicianLabel,
                    policyFilterValue: row.profile?.name || 'Unassigned'
                };
            }),
        [rows]
    );

    const filterOptions = useMemo(
        () => ({
            statuses: uniqueOptions(rowsWithDisplay, (row) => row.status),
            deviceTypes: uniqueOptions(rowsWithDisplay, (row) => row.deviceType),
            departments: uniqueOptions(rowsWithDisplay, (row) => row.department),
            technicians: uniqueOptions(rowsWithDisplay, (row) => row.technicianFilterValue),
            policies: uniqueOptions(rowsWithDisplay, (row) => row.policyFilterValue)
        }),
        [rowsWithDisplay]
    );

    const filteredRows = useMemo(() => {
        const query = normalize(search);

        return rowsWithDisplay.filter((row) => {
            if (filters.status !== ALL_FILTER_VALUE && row.status !== filters.status) return false;
            if (filters.deviceType !== ALL_FILTER_VALUE && row.deviceType !== filters.deviceType) return false;
            if (filters.department !== ALL_FILTER_VALUE && row.department !== filters.department) return false;
            if (filters.technician !== ALL_FILTER_VALUE && row.technicianFilterValue !== filters.technician) return false;
            if (filters.policy !== ALL_FILTER_VALUE && row.policyFilterValue !== filters.policy) return false;

            if (!query) return true;

            return [
                row.assetTag,
                row.deviceType,
                row.userName,
                row.department,
                row.technicianFilterValue,
                row.profile?.name,
                row.status
            ].some((value) => normalize(value).includes(query));
        });
    }, [rowsWithDisplay, search, filters]);

    const selectedRows = useMemo(
        () => rows.filter((row) => selected.has(row.assetId)),
        [rows, selected]
    );
    const visibleSelectedRows = useMemo(
        () => filteredRows.filter((row) => selected.has(row.assetId)),
        [filteredRows, selected]
    );
    const allSelected = filteredRows.length > 0 && visibleSelectedRows.length === filteredRows.length;
    const hasActiveFilters = Boolean(
        search.trim() ||
        filters.status !== ALL_FILTER_VALUE ||
        filters.deviceType !== ALL_FILTER_VALUE ||
        filters.department !== ALL_FILTER_VALUE ||
        filters.technician !== ALL_FILTER_VALUE ||
        filters.policy !== ALL_FILTER_VALUE
    );

    const updateSearch = (value) => {
        setSearch(value);
        setSelected(new Set());
    };

    const updateFilter = (name, value) => {
        setFilters((prev) => ({ ...prev, [name]: value || ALL_FILTER_VALUE }));
        setSelected(new Set());
    };

    const clearFilters = () => {
        setSearch('');
        setFilters({
            status: ALL_FILTER_VALUE,
            deviceType: ALL_FILTER_VALUE,
            department: ALL_FILTER_VALUE,
            technician: ALL_FILTER_VALUE,
            policy: ALL_FILTER_VALUE
        });
        setSelected(new Set());
    };

    const toggleRow = (assetId) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(assetId)) next.delete(assetId);
            else next.add(assetId);
            return next;
        });
    };

    const toggleAll = () => {
        setSelected((prev) => {
            const visibleAssetIds = filteredRows.map((row) => row.assetId);
            if (allSelected) {
                const next = new Set(prev);
                visibleAssetIds.forEach((assetId) => next.delete(assetId));
                return next;
            }
            return new Set([...prev, ...visibleAssetIds]);
        });
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
                        : hasActiveFilters
                          ? `${filteredRows.length} of ${rows.length} asset${rows.length === 1 ? '' : 's'} shown`
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
                <div className="maintenance-assignments-toolbar" aria-label="Assignment search and filters">
                    <div className="maintenance-assignments-search">
                        <label htmlFor={searchInputId}>Search assignments</label>
                        <input
                            id={searchInputId}
                            type="search"
                            value={search}
                            onChange={(event) => updateSearch(event.target.value)}
                            placeholder="Asset tag, user, department, policy..."
                        />
                    </div>

                    <div className="maintenance-assignments-filters">
                        <label htmlFor={statusFilterId}>
                            Status
                            <select
                                id={statusFilterId}
                                value={filters.status}
                                onChange={(event) => updateFilter('status', event.target.value)}
                            >
                                <option value={ALL_FILTER_VALUE}>All statuses</option>
                                {filterOptions.statuses.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label htmlFor={deviceTypeFilterId}>
                            Device type
                            <select
                                id={deviceTypeFilterId}
                                value={filters.deviceType}
                                onChange={(event) => updateFilter('deviceType', event.target.value)}
                            >
                                <option value={ALL_FILTER_VALUE}>All device types</option>
                                {filterOptions.deviceTypes.map((deviceType) => (
                                    <option key={deviceType} value={deviceType}>
                                        {deviceType}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label htmlFor={departmentFilterId}>
                            Department
                            <select
                                id={departmentFilterId}
                                value={filters.department}
                                onChange={(event) => updateFilter('department', event.target.value)}
                            >
                                <option value={ALL_FILTER_VALUE}>All departments</option>
                                {filterOptions.departments.map((department) => (
                                    <option key={department} value={department}>
                                        {department}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label htmlFor={technicianFilterId}>
                            Technician
                            <select
                                id={technicianFilterId}
                                value={filters.technician}
                                onChange={(event) => updateFilter('technician', event.target.value)}
                            >
                                <option value={ALL_FILTER_VALUE}>All technicians</option>
                                {filterOptions.technicians.map((technician) => (
                                    <option key={technician} value={technician}>
                                        {technician}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label htmlFor={policyFilterId}>
                            Policy
                            <select
                                id={policyFilterId}
                                value={filters.policy}
                                onChange={(event) => updateFilter('policy', event.target.value)}
                            >
                                <option value={ALL_FILTER_VALUE}>All policies</option>
                                {filterOptions.policies.map((policy) => (
                                    <option key={policy} value={policy}>
                                        {policy}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    {hasActiveFilters ? (
                        <button type="button" className="workspace-inline-button" onClick={clearFilters}>
                            Clear filters
                        </button>
                    ) : null}
                </div>

                <div className="maintenance-table-container">
                    <table className="workspace-table maintenance-windows-table" aria-label="Maintenance assignments">
                        <thead>
                            <tr>
                                <th scope="col">
                                    <input
                                        type="checkbox"
                                        aria-label="Select all visible assets"
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
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="maintenance-table-empty">
                                        No assignments match your search or filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => {
                                    const technician = row.technicianDisplay;
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
