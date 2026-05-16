import React, { useId, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWindows, useCancelWindow, useCycles, useGenerateSchedule } from '../hooks/useMaintenance.js';
import MaintenanceWindowList from '../components/MaintenanceWindowList.jsx';
import MaintenanceCompletionModal from '../components/MaintenanceCompletionModal.jsx';
import MaintenanceWindowForm from '../components/MaintenanceWindowForm.jsx';
import ManualAssignmentModal from '../components/ManualAssignmentModal.jsx';
import ScheduleGenerationModal from '../components/ScheduleGenerationModal.jsx';
import { MaintenanceSearchCombobox } from '../components/MaintenanceSearchCombobox.jsx';
import { Link } from 'react-router-dom';
import { useSSE } from '../../../shared/hooks/useSSE.js';
import { useToast } from '../../../shared/hooks/useToast.js';
import { FilterSelect } from '../../../shared/components/FilterPanel/FilterSelect';
import { useFilterParams } from '../../../shared/hooks/useFilterParams';
import { SearchEmptyState } from '../../../shared/components/EmptyState/SearchEmptyState';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock.jsx';
import { WorkspacePanel } from '../../../shared/workspace/WorkspacePanel.jsx';
import { formatDisplayDateTime } from '../../../shared/utils/date-format.js';
import { filterCyclesForGeneration } from '../utils/scheduleGeneration.js';
import { formatCycleLabel, formatWindowTitle } from '../utils/maintenanceDisplay.js';
import '../../../shared/workspace/workspace.css';
import './MaintenanceHomePage.css';

const MaintenanceSchedulePage = () => {
    const scheduleHintId = useId();
    const { filters, setFilter, clearFilters } = useFilterParams({ page: '1', perPage: '20' });
    const { data: result, isLoading, error, refetch, isFetching } = useWindows(filters);
    const { data: cycles = [] } = useCycles(false);
    const queryClient = useQueryClient();
    const cancelWindow = useCancelWindow();
    const generateSchedule = useGenerateSchedule();
    const toast = useToast();
    const [signOffWindow, setSignOffWindow] = useState(null);
    const [editingWindow, setEditingWindow] = useState(null);
    const [assigningWindow, setAssigningWindow] = useState(null);
    const [isCreatingWindow, setIsCreatingWindow] = useState(false);
    const [detailWindow, setDetailWindow] = useState(null);
    const [cycleToGenerate, setCycleToGenerate] = useState(null);
    const [generateCycleId, setGenerateCycleId] = useState('');
    const [highlightedWindowId, setHighlightedWindowId] = useState(null);

    const handleMaintenanceEvent = useCallback((data) => {
        queryClient.invalidateQueries({ queryKey: ['maintenance'] });

        if (data?.type === 'maintenance.completed') {
            toast.success('Maintenance Completed', 'Maintenance window has been completed');
        } else if (data?.type === 'maintenance.overdue') {
            toast.warning('Maintenance Overdue', 'A maintenance window is now overdue');
        } else if (data?.type === 'maintenance.upcoming') {
            toast.info('Maintenance Upcoming', 'A maintenance window is now upcoming');
        }
    }, [queryClient, toast]);

    useSSE('maintenance.updated', handleMaintenanceEvent);
    useSSE('maintenance.completed', handleMaintenanceEvent);
    useSSE('maintenance.upcoming', handleMaintenanceEvent);
    useSSE('maintenance.overdue', handleMaintenanceEvent);

    const handleEdit = (window) => {
        setEditingWindow(window);
    };

    const handleCancel = async (window) => {
        const reason = prompt('Enter cancellation reason:');
        if (reason) {
            try {
                await cancelWindow.mutateAsync({ id: window.id, reason });
                toast.success('Window cancelled', 'Maintenance window has been cancelled.');
                if (detailWindow?.id === window.id) {
                    setDetailWindow(null);
                }
            } catch (err) {
                toast.error('Failed to cancel', err.message);
            }
        }
    };

    const handleGenerateSchedule = async (monthsAhead) => {
        if (!cycleToGenerate) return;
        try {
            const payload = await generateSchedule.mutateAsync({
                cycleId: cycleToGenerate.id,
                options: { monthsAhead }
            });
            toast.success('Schedule generated', `${payload.generated} windows created for ${formatCycleLabel(cycleToGenerate.name).primary}.`);
            setCycleToGenerate(null);
            setGenerateCycleId('');
            refetch();
        } catch (err) {
            toast.error('Failed to generate schedule', err.message);
        }
    };

    const activeFiltersCount = Object.keys(filters).filter((key) => key !== 'page' && key !== 'perPage').length;
    const cyclesForGeneration = useMemo(() => {
        return filterCyclesForGeneration(cycles, {
            cycleId: filters.cycleId,
            search: filters.search
        });
    }, [cycles, filters.cycleId, filters.search]);

    const { data: windows, meta } = result || { data: [], meta: {} };

    const cycleOptions = useMemo(
        () => cycles.map((cycle) => ({
            value: cycle.id,
            label: formatCycleLabel(cycle.name, 'Cycle').primary
        })),
        [cycles]
    );

    const handleSearchSelect = (suggestion) => {
        if (suggestion.type === 'cycle') {
            setFilter('cycleId', suggestion.id);
            setFilter('search', suggestion.label);
            return;
        }

        setHighlightedWindowId(suggestion.id);
        const row = document.getElementById(`maintenance-window-${suggestion.id}`);
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const openGenerateModal = () => {
        const cycle = cyclesForGeneration.find((entry) => entry.id === generateCycleId)
            || cyclesForGeneration[0];
        if (!cycle) return;
        setCycleToGenerate(cycle);
    };

    if (isLoading && !result) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock
                    variant="loading"
                    title="Loading maintenance schedule"
                    description="Preparing upcoming windows, filters, and generation actions."
                />
            </section>
        );
    }

    if (error) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock
                    variant="error"
                    title="Unable to load maintenance schedule"
                    description={error.message}
                />
            </section>
        );
    }

    const detailTitle = detailWindow ? formatWindowTitle(detailWindow) : null;

    return (
        <div className="maintenance-module-page maintenance-schedule-page">
            <header className="maintenance-page-header">
                <div>
                    <h2>
                        <span
                            className="workspace-panel-title-hint"
                            tabIndex={0}
                            aria-describedby={scheduleHintId}
                        >
                            Schedule workspace
                            <span
                                className="workspace-panel-title-hint-popup"
                                id={scheduleHintId}
                                role="tooltip"
                                aria-hidden="true"
                            >
                                Review upcoming maintenance windows, filter the queue, and open overdue work before it slips further.
                            </span>
                        </span>
                    </h2>
                </div>
                <div className="maintenance-page-actions">
                    <button
                        className="workspace-inline-button is-primary"
                        onClick={() => setIsCreatingWindow(true)}
                        type="button"
                    >
                        Add ad-hoc window
                    </button>
                    <Link to="/maintenance/history" className="workspace-inline-link">
                        Open history
                    </Link>
                </div>
            </header>

            <div className="maintenance-toolbar">
                <MaintenanceSearchCombobox
                    value={filters.search || ''}
                    onChange={(value) => setFilter('search', value)}
                    onSelect={handleSearchSelect}
                    cycles={cycles}
                    windows={windows}
                    placeholder="Search cycles or windows…"
                    isLoading={isFetching}
                />
                <FilterSelect
                    label="Status"
                    value={filters.status}
                    onChange={(value) => setFilter('status', value)}
                    options={[
                        { value: 'SCHEDULED', label: 'Scheduled' },
                        { value: 'UPCOMING', label: 'Upcoming' },
                        { value: 'OVERDUE', label: 'Overdue' },
                        { value: 'COMPLETED', label: 'Completed' },
                        { value: 'CANCELLED', label: 'Cancelled' }
                    ]}
                />
                <FilterSelect
                    label="Cycle"
                    value={filters.cycleId}
                    onChange={(value) => setFilter('cycleId', value)}
                    options={cycleOptions}
                />
                <FilterSelect
                    label="Device type"
                    value={filters.deviceType}
                    onChange={(value) => setFilter('deviceType', value)}
                    options={[
                        { value: 'LAPTOP', label: 'Laptop' },
                        { value: 'DESKTOP_PC', label: 'Desktop PC' },
                        { value: 'SERVER', label: 'Server' }
                    ]}
                />
                {activeFiltersCount > 0 ? (
                    <button type="button" className="workspace-inline-button" onClick={clearFilters}>
                        Clear filters
                    </button>
                ) : null}
            </div>

            <div className="maintenance-generate-strip">
                <FilterSelect
                    label="Cycle template"
                    value={generateCycleId || cyclesForGeneration[0]?.id || ''}
                    onChange={setGenerateCycleId}
                    options={cyclesForGeneration.map((cycle) => ({
                        value: cycle.id,
                        label: formatCycleLabel(cycle.name, 'Cycle').primary
                    }))}
                    placeholder="Select cycle"
                />
                <button
                    type="button"
                    className="workspace-inline-button is-primary"
                    disabled={generateSchedule.isPending || cyclesForGeneration.length === 0}
                    onClick={openGenerateModal}
                >
                    Generate schedule
                </button>
                {cycles.length === 0 ? (
                    <p className="maintenance-generate-copy">No active cycles found.</p>
                ) : null}
                {cycles.length > 0 && cyclesForGeneration.length === 0 ? (
                    <p className="maintenance-generate-copy">No cycles match your current search or filter.</p>
                ) : null}
            </div>

            {windows && windows.length > 0 ? (
                <WorkspacePanel
                    variant="table"
                    title="Scheduled windows"
                    meta={`${meta?.total ?? windows.length} maintenance window${(meta?.total ?? windows.length) === 1 ? '' : 's'} in view`}
                >
                    <MaintenanceWindowList
                        windows={windows}
                        meta={meta}
                        highlightedWindowId={highlightedWindowId}
                        onPageChange={(page) => setFilter('page', String(page))}
                        onView={(window) => setDetailWindow(window)}
                        onEdit={handleEdit}
                        onCancel={handleCancel}
                        onSignOff={(window) => setSignOffWindow(window)}
                        onAssign={(window) => setAssigningWindow(window)}
                    />
                </WorkspacePanel>
            ) : (
                <WorkspacePanel variant="detail" title="Scheduled windows" meta="No windows match the current schedule view.">
                    {filters.search || activeFiltersCount > 0 ? (
                        <SearchEmptyState searchTerm={filters.search} onClear={clearFilters} />
                    ) : (
                        <p className="maintenance-empty-note">No scheduled maintenance found.</p>
                    )}
                </WorkspacePanel>
            )}

            {detailWindow && detailTitle ? (
                <div className="maintenance-window-detail-overlay">
                    <div className="maintenance-window-detail-modal" role="dialog" aria-modal="true" aria-labelledby="maintenance-detail-title">
                        <header className="maintenance-window-detail-header">
                            <div>
                                <h2 id="maintenance-detail-title">{detailTitle.primary}</h2>
                                {detailTitle.secondary ? <code>{detailTitle.secondary}</code> : null}
                            </div>
                            <button type="button" className="workspace-inline-button" onClick={() => setDetailWindow(null)}>
                                Close
                            </button>
                        </header>
                        <dl className="maintenance-detail-grid">
                            <div>
                                <dt>Status</dt>
                                <dd>{detailWindow.status}</dd>
                            </div>
                            <div>
                                <dt>Scheduled start</dt>
                                <dd>{formatDisplayDateTime(detailWindow.scheduledStartDate, { fallback: '-' })}</dd>
                            </div>
                            <div>
                                <dt>Scheduled end</dt>
                                <dd>{formatDisplayDateTime(detailWindow.scheduledEndDate, { fallback: '-' })}</dd>
                            </div>
                            <div>
                                <dt>Cycle</dt>
                                <dd>{formatCycleLabel(detailWindow.cycleConfig?.name, 'Ad-hoc').primary}</dd>
                            </div>
                            <div>
                                <dt>Description</dt>
                                <dd>{detailWindow.cycleConfig?.description || '-'}</dd>
                            </div>
                        </dl>
                        <div className="maintenance-window-detail-actions">
                            {detailWindow.status !== 'COMPLETED' && detailWindow.status !== 'CANCELLED' ? (
                                <>
                                    <button
                                        type="button"
                                        className="workspace-inline-button"
                                        onClick={() => {
                                            setEditingWindow(detailWindow);
                                            setDetailWindow(null);
                                        }}
                                    >
                                        Edit date
                                    </button>
                                    <button type="button" className="workspace-inline-button is-danger" onClick={() => handleCancel(detailWindow)}>
                                        Cancel window
                                    </button>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}

            {signOffWindow ? (
                <MaintenanceCompletionModal
                    window={signOffWindow}
                    onClose={() => setSignOffWindow(null)}
                    onSuccess={() => refetch()}
                />
            ) : null}

            {editingWindow ? (
                <MaintenanceWindowForm
                    window={editingWindow}
                    onClose={(success) => {
                        setEditingWindow(null);
                        if (success) {
                            toast.success('Window Updated', 'Maintenance window has been updated');
                            refetch();
                        }
                    }}
                />
            ) : null}

            {isCreatingWindow ? (
                <MaintenanceWindowForm
                    window={null}
                    onClose={(success) => {
                        setIsCreatingWindow(false);
                        if (success) {
                            toast.success('Window Created', 'Ad-hoc maintenance window has been created');
                            refetch();
                        }
                    }}
                />
            ) : null}

            {assigningWindow ? (
                <ManualAssignmentModal
                    window={assigningWindow}
                    onClose={(success) => {
                        setAssigningWindow(null);
                        if (success) {
                            toast.success('Assignment Updated', 'Maintenance window has been assigned');
                            refetch();
                        }
                    }}
                />
            ) : null}

            <ScheduleGenerationModal
                isOpen={Boolean(cycleToGenerate)}
                cycle={cycleToGenerate}
                isLoading={generateSchedule.isPending}
                onSubmit={handleGenerateSchedule}
                onClose={() => {
                    if (!generateSchedule.isPending) {
                        setCycleToGenerate(null);
                    }
                }}
            />
        </div>
    );
};

export default MaintenanceSchedulePage;
