
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { maintenanceConfigViewStates, useMaintenanceConfig, useGenerateSchedule } from "../hooks/useMaintenance.js";
import CycleConfigList from "../components/CycleConfigList.jsx";
import CycleConfigForm from "../components/CycleConfigForm.jsx";
import ScheduleGenerationModal from "../components/ScheduleGenerationModal.jsx";
import { useToast } from '../../../shared/hooks/useToast.js';
import "./MaintenanceConfigPage.css";

const MaintenanceConfigPage = () => {
    const { cycles, viewState, error } = useMaintenanceConfig(false);
    const generateSchedule = useGenerateSchedule();
    const toast = useToast();
    const [selectedCycle, setSelectedCycle] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [cycleToGenerate, setCycleToGenerate] = useState(null);

    const handleCreate = () => {
        setSelectedCycle(null);
        setIsEditing(true);
    };

    const handleEdit = (cycle) => {
        setSelectedCycle(cycle);
        setIsEditing(true);
    };

    const handleClose = () => {
        setSelectedCycle(null);
        setIsEditing(false);
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
        return <div className="maintenance-config-state" data-testid="maintenance-config-loading">Loading maintenance cycles...</div>;
    }

    if (viewState === maintenanceConfigViewStates.error) {
        return (
            <div className="maintenance-config-state maintenance-config-state--error" role="alert" data-testid="maintenance-config-error">
                Error loading cycles: {error?.message ?? 'Unable to load maintenance configuration.'}
            </div>
        );
    }

    return (
        <div className="maintenance-config-page">
            <h1>Maintenance Cycles Configuration</h1>

            {isEditing ? (
                <CycleConfigForm
                    cycle={selectedCycle}
                    onClose={handleClose}
                />
            ) : (
                <>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <button onClick={handleCreate} className="btn-primary">Add New Cycle</button>
                        <Link to="/maintenance/checklists" className="btn-secondary" style={{ textDecoration: 'none' }}>
                            Manage Checklists
                        </Link>
                    </div>
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
                </>
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

export default MaintenanceConfigPage;
