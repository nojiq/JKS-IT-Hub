import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTemplate, useCreateTemplate, useUpdateTemplate } from '../hooks/useTemplates';
import TemplateForm from './TemplateForm';
import './templates.css';

export default function TemplateEditor({
    createTitle = 'Create New Template',
    editTitlePrefix = 'Edit Template'
}) {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id;

    const { data: template, isLoading, error } = useTemplate(id);
    const createMutation = useCreateTemplate();
    const updateMutation = useUpdateTemplate();

    const handleSubmit = async (data) => {
        try {
            if (isEditing) {
                await updateMutation.mutateAsync({ id, data });
            } else {
                await createMutation.mutateAsync(data);
            }
            navigate('..');
        } catch (e) {
            console.error(e);
            alert("Error saving template: " + (e.message || "Unknown error"));
        }
    };

    if (isEditing) {
        if (isLoading) return <div className="template-page"><div className="loading">Loading template...</div></div>;
        if (error) return <div className="template-page"><div className="error">Error loading template: {error.message}</div></div>;
        if (!template) return <div className="template-page"><div className="error">Template not found</div></div>;
    }

    return (
        <div className="template-page">
            <header className="page-header">
                <h1>{isEditing ? `${editTitlePrefix}: ${template.name}` : createTitle}</h1>
            </header>
            <TemplateForm
                initialData={isEditing ? template : undefined}
                onSubmit={handleSubmit}
                isSubmitting={createMutation.isPending || updateMutation.isPending}
            />
        </div>
    );
}
