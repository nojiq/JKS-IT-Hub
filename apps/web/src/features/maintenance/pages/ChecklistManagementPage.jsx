import React, { useState } from 'react';
import { useChecklistTemplates } from '../hooks/useMaintenance.js';
import ChecklistTemplateList from '../components/ChecklistTemplateList.jsx';
import ChecklistTemplateForm from '../components/ChecklistTemplateForm.jsx';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock.jsx';
import { WorkspacePanel } from '../../../shared/workspace/WorkspacePanel.jsx';
import './MaintenanceHomePage.css';
import './MaintenanceConfigPage.css';

const ChecklistManagementPage = () => {
    const { data: templates = [], isLoading, error } = useChecklistTemplates(true);
    const [editingTemplateId, setEditingTemplateId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);

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

    const isEditing = isCreating || Boolean(editingTemplateId);

    return (
        <div className="maintenance-module-page maintenance-config-page">
            <WorkspacePanel
                variant="content"
                title="Maintenance Checklists"
                meta="Define reusable checklist templates so each maintenance window starts with the right sign-off steps."
                actions={!isEditing ? (
                    <button type="button" className="workspace-inline-button is-primary" onClick={() => setIsCreating(true)}>
                        Create Checklist
                    </button>
                ) : null}
            >
                {isEditing ? (
                    <ChecklistTemplateForm
                        templateId={editingTemplateId}
                        onClose={() => {
                            setEditingTemplateId(null);
                            setIsCreating(false);
                        }}
                    />
                ) : (
                    <ChecklistTemplateList
                        templates={templates}
                        onEdit={(templateId) => setEditingTemplateId(templateId)}
                    />
                )}
            </WorkspacePanel>
        </div>
    );
};

export default ChecklistManagementPage;
