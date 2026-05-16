
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { maintenanceConfigViewStates, useMaintenanceConfig, useGenerateSchedule } from "../hooks/useMaintenance.js";
import CycleConfigList from "../components/CycleConfigList.jsx";
import CycleConfigModal from "../components/CycleConfigModal.jsx";
import ScheduleGenerationModal from "../components/ScheduleGenerationModal.jsx";
import { useToast } from '../../../shared/hooks/useToast.js';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock.jsx';
import { WorkspacePanel } from '../../../shared/workspace/WorkspacePanel.jsx';
import './MaintenanceHomePage.css';
import "./MaintenanceConfigPage.css";

const MaintenanceConfigPage = () => {
    const { cycles, viewState, error } = useMaintenanceConfig(false);
    const generateSchedule = useGenerateSchedule();
    const toast = useToast();
    const [cycleModal, setCycleModal] = useState(null);
    const [cycleToGenerate, setCycleToGenerate] = useState(null);

    const handleCreate = () => {
        setCycleModal({ type: 'create' });
    };

    const handleEdit = (cycle) => {
        setCycleModal({ type: 'edit', cycle });
    };

    const handleCloseCycleModal = () => {
        setCycleModal(null);
    };

    const handleGenerateSchedule = async (monthsAhead) => {
        if (!cycleToGenerate) return;
        try {
            const result = await generateSchedule.mutateAsync({
                cycleId: cycleToGenerate.id,
                options: { monthsAhead }
            });
            toast.success("Schedule generated", `${result.generated} windows created for ${cycleToGenerate.name}.`);
            setCycleToGenerate(null);
        } catch (e) {
            toast.error("Failed to generate schedule", e.message);
        }
    };

    if (viewState === maintenanceConfigViewStates.loading) {
        return (
            <section className="maintenance-module-page">
                <div data-testid="maintenance-config-loading">
                    <DataStateBlock
                        variant="loading"
                        title="Loading maintenance configuration"
                        description="Preparing cycle definitions and schedule controls."
                    />
                </div>
            </section>
        );
    }

    if (viewState === maintenanceConfigViewStates.error) {
        return (
            <section className="maintenance-module-page">
                <div className="maintenance-config-state maintenance-config-state--error" role="alert" data-testid="maintenance-config-error">
                    Error loading cycles: {error?.message ?? 'Unable to load maintenance configuration.'}
                </div>
            </section>
        );
    }

    return (
        <div className="maintenance-module-page maintenance-config-page">
            <header className="maintenance-page-header">
                <div>
                    <h2>Maintenance cycles</h2>
                    <p>Define reusable cycles, generate upcoming windows, and keep related checklist templates close at hand.</p>
                </div>
            </header>
            <WorkspacePanel
                variant="table"
                title="Cycle templates"
                meta="Active and inactive maintenance cycle definitions."
                actions={!cycleModal ? (
                    <div className="maintenance-config-actions">
                        <button onClick={handleCreate} className="workspace-inline-button is-primary" type="button">Add New Cycle</button>
                        <Link to="/maintenance/checklists" className="workspace-inline-link">
                            Manage Checklists
                        </Link>
                    </div>
                ) : null}
            >
                {viewState === maintenanceConfigViewStates.empty ? (
                    <div className="maintenance-config-state maintenance-config-state--empty" data-testid="maintenance-config-empty">
                        No maintenance configuration available from backend data.
                    </div>
                ) : (
                    <CycleConfigList
                        cycles={cycles}
                        onEdit={handleEdit}
                        onGenerateSchedule={setCycleToGenerate}
                    />
                )}
            </WorkspacePanel>

            <CycleConfigModal
                isOpen={Boolean(cycleModal)}
                mode={cycleModal?.type === 'edit' ? 'edit' : 'create'}
                cycle={cycleModal?.type === 'edit' ? cycleModal.cycle : null}
                onClose={handleCloseCycleModal}
            />

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

export default MaintenanceConfigPage;
