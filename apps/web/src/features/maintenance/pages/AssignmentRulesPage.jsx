import React, { useState } from 'react';
import { useAssignmentRules, useDeactivateAssignmentRule, useResetRotation } from '../hooks/useMaintenance.js';
import AssignmentRuleList from '../components/AssignmentRuleList.jsx';
import AssignmentRuleForm from '../components/AssignmentRuleForm.jsx';
import { useToast } from '../../../shared/hooks/useToast.js';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock.jsx';
import { WorkspacePanel } from '../../../shared/workspace/WorkspacePanel.jsx';
import './MaintenanceHomePage.css';
import './AssignmentRulesPage.css';

const AssignmentRulesPage = () => {
    const { data: rules, isLoading, error } = useAssignmentRules(true);
    const [selectedRule, setSelectedRule] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const toast = useToast();

    const deactivateMutation = useDeactivateAssignmentRule();
    const resetRotationMutation = useResetRotation();

    const handleCreate = () => {
        setSelectedRule(null);
        setIsEditing(true);
    };

    const handleEdit = (rule) => {
        setSelectedRule(rule);
        setIsEditing(true);
    };

    const handleClose = () => {
        setSelectedRule(null);
        setIsEditing(false);
    };

    const handleDeactivate = async (ruleId) => {
        if (!confirm('Are you sure you want to deactivate this assignment rule?')) {
            return;
        }

        try {
            await deactivateMutation.mutateAsync(ruleId);
            toast.success('Rule deactivated', 'Department assignment rule was deactivated.');
        } catch (error) {
            toast.error('Failed to deactivate rule', error.message);
        }
    };

    const handleResetRotation = async (ruleId) => {
        if (!confirm('Reset rotation to the first technician?')) {
            return;
        }

        try {
            await resetRotationMutation.mutateAsync(ruleId);
            toast.success('Rotation reset', 'Rotation was reset to the first technician.');
        } catch (error) {
            toast.error('Failed to reset rotation', error.message);
        }
    };

    if (isLoading) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock
                    variant="loading"
                    title="Loading assignment rules"
                    description="Preparing department coverage and technician rotation rules."
                />
            </section>
        );
    }

    if (error) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock
                    variant="error"
                    title="Unable to load assignment rules"
                    description={error.message}
                />
            </section>
        );
    }

    return (
        <div className="maintenance-module-page assignment-rules-page">
            <WorkspacePanel
                variant="content"
                title="Department Assignment Rules"
                meta="Control which technicians receive maintenance windows for each department and strategy."
                actions={!isEditing ? (
                    <button onClick={handleCreate} className="workspace-inline-button is-primary" type="button">
                        Create New Rule
                    </button>
                ) : null}
            >
                {isEditing ? (
                    <AssignmentRuleForm rule={selectedRule} onClose={handleClose} />
                ) : (
                    <AssignmentRuleList
                        rules={rules}
                        onEdit={handleEdit}
                        onDeactivate={handleDeactivate}
                        onResetRotation={handleResetRotation}
                    />
                )}
            </WorkspacePanel>
        </div>
    );
};

export default AssignmentRulesPage;
