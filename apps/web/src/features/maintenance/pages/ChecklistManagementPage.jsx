import React, { useId, useState } from 'react';
import { useChecklistTemplates } from '../hooks/useMaintenance.js';
import ChecklistTemplateList from '../components/ChecklistTemplateList.jsx';
import ChecklistTemplateModal from '../components/ChecklistTemplateModal.jsx';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock.jsx';
import { WorkspacePanel } from '../../../shared/workspace/WorkspacePanel.jsx';
import '../../../shared/workspace/workspace.css';
import './MaintenanceHomePage.css';
import './MaintenanceConfigPage.css';

const ChecklistManagementPage = () => {
    const checklistsHintId = useId();
    const { data: templates = [], isLoading, error } = useChecklistTemplates(true);
    const [checklistModal, setChecklistModal] = useState(null);

    if (isLoading) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock
                    variant="loading"
                    title="Loading maintenance checklists"
                    description="Preparing reusable checklist templates for future windows."
                />
            </section>
        );
    }

    if (error) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock
                    variant="error"
                    title="Unable to load checklist templates"
                    description={error.message}
                />
            </section>
        );
    }

    return (
        <div className="maintenance-module-page maintenance-config-page">
            <header className="maintenance-page-header">
                <div>
                    <h2>
                        <span
                            className="workspace-panel-title-hint"
                            tabIndex={0}
                            aria-describedby={checklistsHintId}
                        >
                            Maintenance checklists
                            <span
                                className="workspace-panel-title-hint-popup"
                                id={checklistsHintId}
                                role="tooltip"
                                aria-hidden="true"
                            >
                                Define reusable checklist templates so each maintenance window starts with the right sign-off steps.
                            </span>
                        </span>
                    </h2>
                </div>
            </header>
            <WorkspacePanel
                variant="table"
                title="Checklist templates"
                titleHint="Reusable sign-off steps for maintenance windows."
                actions={
                    !checklistModal ? (
                        <button
                            type="button"
                            className="workspace-inline-button is-primary"
                            onClick={() => setChecklistModal({ type: 'create' })}
                        >
                            Create checklist
                        </button>
                    ) : null
                }
            >
                <ChecklistTemplateList
                    templates={templates}
                    onEdit={(templateId) => setChecklistModal({ type: 'edit', templateId })}
                />
            </WorkspacePanel>

            <ChecklistTemplateModal
                isOpen={checklistModal != null}
                mode={checklistModal?.type === 'edit' ? 'edit' : 'create'}
                templateId={checklistModal?.type === 'edit' ? checklistModal.templateId : null}
                onClose={() => setChecklistModal(null)}
            />
        </div>
    );
};

export default ChecklistManagementPage;
