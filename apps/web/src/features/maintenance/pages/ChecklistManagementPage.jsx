import React, { useState } from 'react';
import { useChecklistTemplates } from '../hooks/useMaintenance.js';
import ChecklistTemplateList from '../components/ChecklistTemplateList.jsx';
import ChecklistTemplateForm from '../components/ChecklistTemplateForm.jsx';

const ChecklistManagementPage = () => {
    const { data: templates = [], isLoading, error } = useChecklistTemplates(true);
    const [editingTemplateId, setEditingTemplateId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);

    if (isLoading) return <div>Loading checklist templates...</div>;
    if (error) return <div>Error loading checklist templates: {error.message}</div>;

    const isEditing = isCreating || Boolean(editingTemplateId);

    return (
        <div className="maintenance-config-page">
            <h1>Maintenance Checklists</h1>

            {isEditing ? (
                <ChecklistTemplateForm
                    templateId={editingTemplateId}
                    onClose={() => {
                        setEditingTemplateId(null);
                        setIsCreating(false);
                    }}
                />
            ) : (
                <>
                    <button type="button" className="btn-primary" onClick={() => setIsCreating(true)}>
                        Create Checklist
                    </button>
                    <ChecklistTemplateList
                        templates={templates}
                        onEdit={(templateId) => setEditingTemplateId(templateId)}
                    />
                </>
            )}
        </div>
    );
};

export default ChecklistManagementPage;
