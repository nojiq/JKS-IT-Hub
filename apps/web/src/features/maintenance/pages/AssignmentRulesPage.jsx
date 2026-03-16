import React, { useState } from 'react';
import { useAssignmentRules, useDeactivateAssignmentRule, useResetRotation } from '../hooks/useMaintenance.js';
import AssignmentRuleList from '../components/AssignmentRuleList.jsx';
import AssignmentRuleForm from '../components/AssignmentRuleForm.jsx';
import { useToast } from '../../../shared/hooks/useToast.js';
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

    if (isLoading) return <div className="loading">Loading assignment rules...</div>;
    if (error) return <div className="error-message">Error loading rules: {error.message}</div>;

    return (
        <div className="assignment-rules-page">
            <div className="page-header">
                <h1>Department Assignment Rules</h1>
                <p className="page-description">
                    Configure auto-assignment rules for maintenance windows by department.
                </p>
            </div>

            {isEditing ? (
                <AssignmentRuleForm rule={selectedRule} onClose={handleClose} />
            ) : (
                <>
                    <div className="page-actions">
                        <button onClick={handleCreate} className="btn-primary">
                            Create New Rule
                        </button>
                    </div>
                    <AssignmentRuleList
                        rules={rules}
                        onEdit={handleEdit}
                        onDeactivate={handleDeactivate}
                        onResetRotation={handleResetRotation}
                    />
                </>
            )}
        </div>
    );
};

export default AssignmentRulesPage;
