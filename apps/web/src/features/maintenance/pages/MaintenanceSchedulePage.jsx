import React, { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWindows, useCancelWindow, useCycles, useGenerateSchedule } from "../hooks/useMaintenance.js";
import MaintenanceWindowList from "../components/MaintenanceWindowList.jsx";
import MaintenanceCompletionModal from "../components/MaintenanceCompletionModal.jsx";
import MaintenanceWindowForm from "../components/MaintenanceWindowForm.jsx";
import ManualAssignmentModal from "../components/ManualAssignmentModal.jsx";
import ScheduleGenerationModal from '../components/ScheduleGenerationModal.jsx';
import { Link } from "react-router-dom";
import { useSSE } from '../../../shared/hooks/useSSE.js';
import { useToast } from '../../../shared/hooks/useToast.js';
import "./MaintenanceSchedulePage.css";

import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { FilterPanel } from '../../../shared/components/FilterPanel/FilterPanel';
import { FilterSelect } from '../../../shared/components/FilterPanel/FilterSelect';
import { useFilterParams } from '../../../shared/hooks/useFilterParams';
import { SearchEmptyState } from '../../../shared/components/EmptyState/SearchEmptyState';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock.jsx';
import { WorkspacePanel } from '../../../shared/workspace/WorkspacePanel.jsx';
import { formatDisplayDateTime } from '../../../shared/utils/date-format.js';
import { filterCyclesForGeneration } from '../utils/scheduleGeneration.js';
import './MaintenanceHomePage.css';

const MaintenanceSchedulePage = () => {
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

    // SSE Event Handler - invalidate queries on real-time maintenance updates
    const handleMaintenanceEvent = useCallback((data) => {
        queryClient.invalidateQueries({ queryKey: ['maintenance'] });

        // Show toast notification for completed maintenance
        if (data?.type === 'maintenance.completed') {
            toast.success('Maintenance Completed', 'Maintenance window has been completed');
        } else if (data?.type === 'maintenance.overdue') {
            toast.warning('Maintenance Overdue', 'A maintenance window is now overdue');
        } else if (data?.type === 'maintenance.upcoming') {
            toast.info('Maintenance Upcoming', 'A maintenance window is now upcoming');
        }
    }, [queryClient, toast]);

    // Subscribe to maintenance events
    useSSE('maintenance.updated', handleMaintenanceEvent);
    useSSE('maintenance.completed', handleMaintenanceEvent);
    useSSE('maintenance.upcoming', handleMaintenanceEvent);
    useSSE('maintenance.overdue', handleMaintenanceEvent);

    const handleEdit = (window) => {
        setEditingWindow(window);
    };

    const handleCancel = async (window) => {
        const reason = prompt("Enter cancellation reason:");
        if (reason) {
            try {
                await cancelWindow.mutateAsync({ id: window.id, reason });
                toast.success('Window cancelled', 'Maintenance window has been cancelled.');
                if (detailWindow?.id === window.id) {
                    setDetailWindow(null);
                }
            } catch (err) {
                toast.error("Failed to cancel", err.message);
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
            toast.success("Schedule generated", `${payload.generated} windows created for ${cycleToGenerate.name}.`);
            setCycleToGenerate(null);
            refetch();
        } catch (err) {
            toast.error("Failed to generate schedule", err.message);
        }
    };

    // Calculate active filters (excluding default pagination)
    const activeFiltersCount = Object.keys(filters).filter(k => k !== 'page' && k !== 'perPage').length;
    const cyclesForGeneration = useMemo(() => {
        return filterCyclesForGeneration(cycles, {
            cycleId: filters.cycleId,
            search: filters.search
        });
    }, [cycles, filters.cycleId, filters.search]);
    const { data: windows, meta } = result || { data: [], meta: {} };

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

    return (
        <div className="maintenance-module-page maintenance-schedule-page">
            <WorkspacePanel
                variant="content"
                title="Schedule Workspace"
                meta="Review upcoming maintenance windows, filter the queue, and open overdue work before it slips further."
                actions={(
                    <div className="maintenance-module-toolbar-actions">
                        <button className="workspace-inline-button is-primary" onClick={() => setIsCreatingWindow(true)} type="button">
                            Add Ad-hoc Window
                        </button>
                        <Link to="/maintenance/history" className="workspace-inline-link">
                            Open History
                        </Link>
                    </div>
                )}
            >
                <div className="maintenance-module-filter">
                    <SearchInput
                        value={filters.search || ''}
                        onChange={(val) => setFilter('search', val)}
                        onClear={() => setFilter('search', '')}
                        placeholder="Search by window or cycle name..."
                        isLoading={isFetching}
                    />

                    <FilterPanel
                        activeCount={activeFiltersCount}
                        onClearAll={clearFilters}
                        title="Filter Schedule"
                    >
                        <FilterSelect
                            label="Status"
                            value={filters.status}
                            onChange={(val) => setFilter('status', val)}
                            options={[
                                { value: 'SCHEDULED', label: 'Scheduled' },
                                { value: 'UPCOMING', label: 'Upcoming' },
                                { value: 'OVERDUE', label: 'Overdue' },
                                { value: 'COMPLETED', label: 'Completed' },
                                { value: 'CANCELLED', label: 'Cancelled' }
                            ]}
                        />
                        <FilterSelect
                            label="Cycle Type"
                            value={filters.cycleId}
                            onChange={(val) => setFilter('cycleId', val)}
                            options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
                        />
                        <FilterSelect
                            label="Device Type"
                            value={filters.deviceType}
                            onChange={(val) => setFilter('deviceType', val)}
                            options={[
                                { value: 'LAPTOP', label: 'Laptop' },
                                { value: 'DESKTOP_PC', label: 'Desktop PC' },
                                { value: 'SERVER', label: 'Server' }
                            ]}
                        />
                    </FilterPanel>
                </div>
            </WorkspacePanel>

            <WorkspacePanel
                variant="detail"
                title="Generate Future Schedule"
                meta="Use active cycle templates to create the next set of maintenance windows."
            >
                <section className="schedule-generate-section">
                    <div className="schedule-generate-actions">
                        {cycles.length === 0 && <span>No active cycles found.</span>}
                        {cycles.length > 0 && cyclesForGeneration.length === 0 && (
                            <span className="schedule-generate-empty">No cycles match your current search or filter.</span>
                        )}
                        {cyclesForGeneration.map((cycle) => (
                            <button
                                key={cycle.id}
                                type="button"
                                className="workspace-inline-button"
                                disabled={generateSchedule.isPending}
                                onClick={() => setCycleToGenerate(cycle)}
                            >
                                Generate {cycle.name}
                            </button>
                        ))}
                    </div>
                </section>
            </WorkspacePanel>

            {windows && windows.length > 0 ? (
                <WorkspacePanel
                    variant="table"
                    title="Scheduled Windows"
                    meta={`${meta?.total ?? windows.length} maintenance window${(meta?.total ?? windows.length) === 1 ? '' : 's'} in view`}
                >
                    <MaintenanceWindowList
                        windows={windows}
                        meta={meta}
                        onPageChange={(page) => setFilter('page', String(page))}
                        onView={(window) => setDetailWindow(window)}
                        onEdit={handleEdit}
                        onCancel={handleCancel}
                        onSignOff={(window) => setSignOffWindow(window)}
                        onAssign={(window) => setAssigningWindow(window)}
                    />
                </WorkspacePanel>
            ) : (
                <WorkspacePanel variant="detail" title="Scheduled Windows" meta="No windows match the current schedule view.">
                    {filters.search || activeFiltersCount > 0 ? (
                        <SearchEmptyState searchTerm={filters.search} onClear={clearFilters} />
                    ) : (
                        <p className="maintenance-empty-note">No scheduled maintenance found.</p>
                    )}
                </WorkspacePanel>
            )}

            {detailWindow && (
                <div className="maintenance-window-detail-overlay">
                    <div className="maintenance-window-detail-modal">
                        <div className="maintenance-window-detail-header">
                            <h2>{detailWindow.cycleConfig?.name || 'Ad-hoc'} Window</h2>
                            <button type="button" className="btn-secondary" onClick={() => setDetailWindow(null)}>
                                Close
                            </button>
                        </div>
                        <div className="maintenance-window-detail-body">
                            <p><strong>Status:</strong> {detailWindow.status}</p>
                            <p><strong>Scheduled Start:</strong> {formatDisplayDateTime(detailWindow.scheduledStartDate, { fallback: '-' })}</p>
                            <p><strong>Scheduled End:</strong> {formatDisplayDateTime(detailWindow.scheduledEndDate, { fallback: '-' })}</p>
                            <p><strong>Cycle:</strong> {detailWindow.cycleConfig?.name || 'Ad-hoc'}</p>
                            <p><strong>Description:</strong> {detailWindow.cycleConfig?.description || '-'}</p>
                        </div>
                        <div className="maintenance-window-detail-actions">
                            {detailWindow.status !== 'COMPLETED' && detailWindow.status !== 'CANCELLED' && (
                                <>
                                    <button type="button" className="btn-secondary" onClick={() => {
                                        setEditingWindow(detailWindow);
                                        setDetailWindow(null);
                                    }}>
                                        Edit Date
                                    </button>
                                    <button type="button" className="btn-danger" onClick={() => handleCancel(detailWindow)}>
                                        Cancel Window
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {signOffWindow && (
                <MaintenanceCompletionModal
                    window={signOffWindow}
                    onClose={() => setSignOffWindow(null)}
                    onSuccess={() => refetch()}
                />
            )}

            {editingWindow && (
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
            )}

            {isCreatingWindow && (
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
            )}

            {assigningWindow && (
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
            )}

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
