import React, { useId, useState } from 'react';
import { useAssignmentRules, useDeactivateAssignmentRule, useResetRotation } from '../hooks/useMaintenance.js';
import AssignmentRuleList from '../components/AssignmentRuleList.jsx';
import AssignmentRuleModal from '../components/AssignmentRuleModal.jsx';
import { MaintenanceConfirmDialog } from '../components/MaintenanceConfirmDialog.jsx';
import { useToast } from '../../../shared/hooks/useToast.js';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock.jsx';
import { WorkspacePanel } from '../../../shared/workspace/WorkspacePanel.jsx';
import '../../../shared/workspace/workspace.css';
import './MaintenanceHomePage.css';
import './AssignmentRulesPage.css';

const AssignmentRulesPage = () => {
    const rulesHintId = useId();
    const { data: rules, isLoading, error } = useAssignmentRules(true);
    const [ruleModal, setRuleModal] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);
    const toast = useToast();

    const deactivateMutation = useDeactivateAssignmentRule();
    const resetRotationMutation = useResetRotation();

    const handleCreate = () => {
        setRuleModal({ type: 'create' });
    };

    const handleEdit = (rule) => {
        setRuleModal({ type: 'edit', rule });
    };

    const handleCloseModal = () => {
        setRuleModal(null);
    };

    const handleConfirmAction = async () => {
        if (!confirmAction) return;
        try {
            if (confirmAction.kind === 'deactivate') {
                await deactivateMutation.mutateAsync(confirmAction.rule.id);
                toast.success('Rule deactivated', 'Department assignment rule was deactivated.');
            } else {
                await resetRotationMutation.mutateAsync(confirmAction.rule.id);
                toast.success('Rotation reset', 'Rotation was reset to the first PIC.');
            }
            setConfirmAction(null);
        } catch (e) {
            toast.error(
                confirmAction.kind === 'deactivate' ? 'Failed to deactivate rule' : 'Failed to reset rotation',
                e.message
            );
        }
    };

    const confirmPending = deactivateMutation.isPending || resetRotationMutation.isPending;

    if (isLoading) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock
                    variant="loading"
                    title="Loading assignment rules"
                    description="Preparing department coverage and PIC rotation rules."
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
            <header className="maintenance-page-header">
                <div>
                    <h2>
                        <span
                            className="workspace-panel-title-hint"
                            tabIndex={0}
                            aria-describedby={rulesHintId}
                        >
                            Assignment rules
                            <span
                                className="workspace-panel-title-hint-popup"
                                id={rulesHintId}
                                role="tooltip"
                                aria-hidden="true"
                            >
                                Control which PICs receive maintenance windows for each department and strategy.
                            </span>
                        </span>
                    </h2>
                </div>
            </header>
            <WorkspacePanel
                variant="table"
                title="Department rules"
                titleHint="Rotation and fixed assignment coverage by department."
                actions={
                    !ruleModal ? (
                        <button onClick={handleCreate} className="workspace-inline-button is-primary" type="button">
                            Create rule
                        </button>
                    ) : null
                }
            >
                <AssignmentRuleList
                    rules={rules}
                    onEdit={handleEdit}
                    onDeactivate={(rule) => setConfirmAction({ kind: 'deactivate', rule })}
                    onResetRotation={(rule) => setConfirmAction({ kind: 'reset', rule })}
                />
            </WorkspacePanel>

            <AssignmentRuleModal
                isOpen={ruleModal != null}
                mode={ruleModal?.type === 'edit' ? 'edit' : 'create'}
                rule={ruleModal?.type === 'edit' ? ruleModal.rule : null}
                onClose={handleCloseModal}
            />

            <MaintenanceConfirmDialog
                open={confirmAction != null}
                title={confirmAction?.kind === 'deactivate' ? 'Deactivate this rule?' : 'Reset rotation?'}
                confirmLabel={confirmAction?.kind === 'deactivate' ? 'Deactivate' : 'Reset rotation'}
                confirmVariant={confirmAction?.kind === 'deactivate' ? 'danger' : 'primary'}
                onClose={() => {
                    if (!confirmPending) setConfirmAction(null);
                }}
                onConfirm={handleConfirmAction}
                isPending={confirmPending}
            >
                {confirmAction?.kind === 'deactivate' ? (
                    <p>
                        <strong>{confirmAction.rule.department}</strong> will stop receiving new assignments from this
                        rule.
                    </p>
                ) : confirmAction?.kind === 'reset' ? (
                    <p>
                        Rotation for <strong>{confirmAction.rule.department}</strong> will start again from the first PIC
                        in the list.
                    </p>
                ) : null}
            </MaintenanceConfirmDialog>
        </div>
    );
};

export default AssignmentRulesPage;
