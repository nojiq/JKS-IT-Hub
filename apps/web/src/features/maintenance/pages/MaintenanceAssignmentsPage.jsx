import { useEffect, useId, useMemo, useState } from 'react';
import { useAssignmentMatrix, useMaintenanceProfiles } from '../hooks/useMaintenance.js';
import AssignPolicyModal from '../components/AssignPolicyModal.jsx';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock.jsx';
import { WorkspacePanel } from '../../../shared/workspace/WorkspacePanel.jsx';
import { useToast } from '../../../shared/hooks/useToast.js';
import { createMaintenanceAssignment } from '../api/preventiveMaintenanceApi.js';
import { fetchActiveItDepartmentUsers, getUserDisplayName } from '../utils/maintenanceAssignees.js';
import { formatTechnician } from '../utils/maintenanceDisplay.js';
import { formatTaskDueLabel } from '../utils/taskUrgency.js';
import '../../../shared/workspace/workspace.css';
import './MaintenanceAssignmentsPage.css';
import './MaintenanceHomePage.css';

const ALL_FILTER_VALUE = 'all';
const ASSIGNMENTS_PER_PAGE = 25;

const normalize = (value) => String(value || '').trim().toLowerCase();

const uniqueOptions = (rows, getValue) => {
    return Array.from(
        new Set(rows.map(getValue).map((value) => String(value || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
};

const MaintenanceAssignmentsPage = () => {
    const toast = useToast();
    const searchInputId = useId();
    const statusFilterId = useId();
    const deviceTypeFilterId = useId();
    const departmentFilterId = useId();
    const technicianFilterId = useId();
    const policyFilterId = useId();
    const bulkPolicySelectId = useId();
    const bulkTechnicianSelectId = useId();
    const bulkStartDateInputId = useId();
    const { data: rows = [], isLoading, error, refetch } = useAssignmentMatrix();
    const { data: profiles = [] } = useMaintenanceProfiles(false);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({
        status: ALL_FILTER_VALUE,
        deviceType: ALL_FILTER_VALUE,
        department: ALL_FILTER_VALUE,
        technician: ALL_FILTER_VALUE,
        policy: ALL_FILTER_VALUE
    });
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState(() => new Set());
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignModalRows, setAssignModalRows] = useState([]);
    const [bulkProfileId, setBulkProfileId] = useState('');
    const [bulkTechnicianId, setBulkTechnicianId] = useState('');
    const [bulkStartDate, setBulkStartDate] = useState('');
    const [technicians, setTechnicians] = useState([]);
    const [isLoadingTechnicians, setIsLoadingTechnicians] = useState(false);
    const [isBulkSaving, setIsBulkSaving] = useState(false);
    const [bulkError, setBulkError] = useState(null);

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

    const pageCount = Math.max(1, Math.ceil(filteredRows.length / ASSIGNMENTS_PER_PAGE));
    const safePage = Math.min(page, pageCount);
    const paginatedRows = filteredRows.slice(
        (safePage - 1) * ASSIGNMENTS_PER_PAGE,
        safePage * ASSIGNMENTS_PER_PAGE
    );

    const selectedRows = useMemo(
        () => rows.filter((row) => selected.has(row.assetId)),
        [rows, selected]
    );

    useEffect(() => {
        if (selected.size === 0 || technicians.length > 0) return undefined;

        let active = true;
        const loadTechnicians = async () => {
            try {
                setIsLoadingTechnicians(true);
                const result = await fetchActiveItDepartmentUsers();
                if (active) setTechnicians(result);
            } catch {
                if (active) setBulkError('Failed to load IT assignees');
            } finally {
                if (active) setIsLoadingTechnicians(false);
            }
        };

        loadTechnicians();

        return () => {
            active = false;
        };
    }, [selected.size, technicians.length]);

    const visibleSelectedRows = useMemo(
        () => paginatedRows.filter((row) => selected.has(row.assetId)),
        [paginatedRows, selected]
    );
    const selectedTechnician = useMemo(
        () => technicians.find((technician) => technician.id === bulkTechnicianId) || null,
        [technicians, bulkTechnicianId]
    );
    const allSelected = paginatedRows.length > 0 && visibleSelectedRows.length === paginatedRows.length;
    const hasActiveFilters = Boolean(
        search.trim() ||
        filters.status !== ALL_FILTER_VALUE ||
        filters.deviceType !== ALL_FILTER_VALUE ||
        filters.department !== ALL_FILTER_VALUE ||
        filters.technician !== ALL_FILTER_VALUE ||
        filters.policy !== ALL_FILTER_VALUE
    );
    const canBulkAssign = Boolean(
        selectedRows.length > 0 &&
        bulkProfileId &&
        bulkTechnicianId &&
        !isBulkSaving
    );

    const updateSearch = (value) => {
        setSearch(value);
        setSelected(new Set());
        setPage(1);
    };

    const updateFilter = (name, value) => {
        setFilters((prev) => ({ ...prev, [name]: value || ALL_FILTER_VALUE }));
        setSelected(new Set());
        setPage(1);
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
        setPage(1);
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
            const visibleAssetIds = paginatedRows.map((row) => row.assetId);
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

    const handleBulkAssign = async (event) => {
        event.preventDefault();
        if (!canBulkAssign) return;

        setIsBulkSaving(true);
        setBulkError(null);
        try {
            const isoStartDate = bulkStartDate ? new Date(bulkStartDate).toISOString() : undefined;
            await Promise.all(
                selectedRows.map((row) => {
                    const payload = {
                        assetId: row.assetId,
                        profileId: bulkProfileId,
                        userId: bulkTechnicianId
                    };
                    if (isoStartDate) {
                        payload.startDate = isoStartDate;
                    }
                    return createMaintenanceAssignment(payload);
                })
            );
            const technicianLabel =
                getUserDisplayName(selectedTechnician) ||
                'selected assignee';
            toast.success(
                'Assignments confirmed',
                `${selectedRows.length} asset${selectedRows.length === 1 ? '' : 's'} linked to ${technicianLabel}.`
            );
            setSelected(new Set());
            setBulkProfileId('');
            setBulkTechnicianId('');
            setBulkStartDate('');
            await refetch();
        } catch (err) {
            const message = err.message || 'Failed to save assignments';
            setBulkError(message);
            toast.error('Failed to assign assets', message);
        } finally {
            setIsBulkSaving(false);
        }
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
        <div className={`maintenance-module-page maintenance-assignments-page${selectedRows.length > 0 ? ' has-float-bar' : ''}`}>
            <WorkspacePanel
                variant="table"
                title="Asset assignments"
                titleHint="Link each asset to a maintenance policy and technician. Scheduling runs automatically from policy intervals."
                meta={
                    hasActiveFilters
                        ? `${filteredRows.length} of ${rows.length} shown`
                        : null
                }
                actions={
                    <button
                        type="button"
                        className="workspace-inline-button is-primary"
                        onClick={() => openAssignModal()}
                    >
                        Assign policy
                    </button>
                }
            >
                <div className="maintenance-assignments-toolbar" aria-label="Assignment search and filters">
                    <input
                        id={searchInputId}
                        type="search"
                        className="maintenance-assignments-search-input"
                        value={search}
                        onChange={(event) => updateSearch(event.target.value)}
                        placeholder="Search asset tag, user, department, policy…"
                        aria-label="Search assignments"
                    />

                    <div className="maintenance-assignments-filters">
                        <select
                            id={statusFilterId}
                            aria-label="Filter by status"
                            value={filters.status}
                            onChange={(event) => updateFilter('status', event.target.value)}
                        >
                            <option value={ALL_FILTER_VALUE}>All statuses</option>
                            {filterOptions.statuses.map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>

                        <select
                            id={deviceTypeFilterId}
                            aria-label="Filter by device type"
                            value={filters.deviceType}
                            onChange={(event) => updateFilter('deviceType', event.target.value)}
                        >
                            <option value={ALL_FILTER_VALUE}>All device types</option>
                            {filterOptions.deviceTypes.map((deviceType) => (
                                <option key={deviceType} value={deviceType}>{deviceType}</option>
                            ))}
                        </select>

                        <select
                            id={departmentFilterId}
                            aria-label="Filter by department"
                            value={filters.department}
                            onChange={(event) => updateFilter('department', event.target.value)}
                        >
                            <option value={ALL_FILTER_VALUE}>All departments</option>
                            {filterOptions.departments.map((department) => (
                                <option key={department} value={department}>{department}</option>
                            ))}
                        </select>

                        <select
                            id={technicianFilterId}
                            aria-label="Filter by technician"
                            value={filters.technician}
                            onChange={(event) => updateFilter('technician', event.target.value)}
                        >
                            <option value={ALL_FILTER_VALUE}>All technicians</option>
                            {filterOptions.technicians.map((technician) => (
                                <option key={technician} value={technician}>{technician}</option>
                            ))}
                        </select>

                        <select
                            id={policyFilterId}
                            aria-label="Filter by policy"
                            value={filters.policy}
                            onChange={(event) => updateFilter('policy', event.target.value)}
                        >
                            <option value={ALL_FILTER_VALUE}>All policies</option>
                            {filterOptions.policies.map((policy) => (
                                <option key={policy} value={policy}>{policy}</option>
                            ))}
                        </select>

                        {hasActiveFilters ? (
                            <button type="button" className="workspace-inline-button maintenance-assignments-clear-btn" onClick={clearFilters}>
                                Clear
                            </button>
                        ) : null}
                    </div>
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
                                paginatedRows.map((row) => {
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
                                                    {String(row.status || '').toLowerCase() !== 'unassigned' ? 'Reassign' : 'Assign'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {pageCount > 1 ? (
                    <div className="maintenance-assignments-pagination" role="navigation" aria-label="Table pagination">
                        <p className="maintenance-assignments-pagination__summary">
                            Page {safePage} of {pageCount} &middot; {filteredRows.length} asset{filteredRows.length === 1 ? '' : 's'}
                        </p>
                        <div className="maintenance-assignments-pagination__controls">
                            <button
                                type="button"
                                className="workspace-inline-button"
                                onClick={() => setPage(1)}
                                disabled={safePage === 1}
                                aria-label="First page"
                            >
                                &laquo;
                            </button>
                            <button
                                type="button"
                                className="workspace-inline-button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={safePage === 1}
                                aria-label="Previous page"
                            >
                                Prev
                            </button>
                            <button
                                type="button"
                                className="workspace-inline-button"
                                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                                disabled={safePage === pageCount}
                                aria-label="Next page"
                            >
                                Next
                            </button>
                            <button
                                type="button"
                                className="workspace-inline-button"
                                onClick={() => setPage(pageCount)}
                                disabled={safePage === pageCount}
                                aria-label="Last page"
                            >
                                &raquo;
                            </button>
                        </div>
                    </div>
                ) : null}
            </WorkspacePanel>

            {selectedRows.length > 0 ? (
                <div className="maintenance-assignments-float-bar" role="region" aria-label="Bulk assignment actions">
                    <div className="maintenance-assignments-float-bar__inner">
                        <p className="maintenance-assignments-float-bar__count">
                            <strong>{selectedRows.length}</strong> asset{selectedRows.length === 1 ? '' : 's'} selected
                        </p>
                        {bulkError ? <p className="maintenance-assignments-float-bar__error" role="alert">{bulkError}</p> : null}
                        <form className="maintenance-assignments-bulk-actions" onSubmit={handleBulkAssign}>
                            <select
                                id={bulkPolicySelectId}
                                aria-label="Bulk policy"
                                value={bulkProfileId}
                                onChange={(event) => setBulkProfileId(event.target.value)}
                                disabled={isBulkSaving}
                            >
                                <option value="">Policy…</option>
                                {profiles.map((profile) => (
                                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                                ))}
                            </select>
                            <select
                                id={bulkTechnicianSelectId}
                                aria-label="Assign to technician"
                                value={bulkTechnicianId}
                                onChange={(event) => setBulkTechnicianId(event.target.value)}
                                disabled={isLoadingTechnicians || isBulkSaving || technicians.length === 0}
                            >
                                <option value="">
                                    {isLoadingTechnicians ? 'Loading…' : 'Assignee…'}
                                </option>
                                {technicians.map((technician) => (
                                    <option key={technician.id} value={technician.id}>
                                        {getUserDisplayName(technician)}
                                    </option>
                                ))}
                            </select>
                            <input
                                id={bulkStartDateInputId}
                                type="date"
                                aria-label="Start date"
                                value={bulkStartDate}
                                onChange={(event) => setBulkStartDate(event.target.value)}
                                disabled={isBulkSaving}
                            />
                            <button type="submit" className="workspace-inline-button is-primary" disabled={!canBulkAssign}>
                                {isBulkSaving ? 'Applying…' : 'Apply'}
                            </button>
                            <button
                                type="button"
                                className="workspace-inline-button"
                                onClick={() => { setSelected(new Set()); setBulkProfileId(''); setBulkTechnicianId(''); }}
                                disabled={isBulkSaving}
                            >
                                Deselect
                            </button>
                        </form>
                    </div>
                </div>
            ) : null}

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
