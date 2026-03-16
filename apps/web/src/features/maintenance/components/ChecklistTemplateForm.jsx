import React, { useEffect, useMemo, useState } from 'react';
import {
    useChecklistTemplate,
    useCreateChecklistTemplate,
    useUpdateChecklistTemplate,
    useDeactivateChecklistTemplate
} from '../hooks/useMaintenance.js';
import { useToast } from '../../../shared/hooks/useToast.js';
import ChecklistItemEditor from './ChecklistItemEditor.jsx';

const ChecklistTemplateForm = ({ templateId, onClose }) => {
    const isEdit = Boolean(templateId);
    const { data: loadedTemplate, isLoading } = useChecklistTemplate(templateId);
    const createMutation = useCreateChecklistTemplate();
    const updateMutation = useUpdateChecklistTemplate();
    const deactivateMutation = useDeactivateChecklistTemplate();
    const toast = useToast();

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        isActive: true,
        items: []
    });

    const busy = createMutation.isPending || updateMutation.isPending || deactivateMutation.isPending;

    useEffect(() => {
        if (!loadedTemplate) return;
        setFormData({
            name: loadedTemplate.name || '',
            description: loadedTemplate.description || '',
            isActive: loadedTemplate.isActive !== false,
            items: (loadedTemplate.items || []).map((item, index) => ({
                title: item.title || '',
                description: item.description || '',
                isRequired: item.isRequired !== false,
                orderIndex: item.orderIndex ?? index
            }))
        });
    }, [loadedTemplate]);

    const validationError = useMemo(() => {
        if (!formData.name.trim()) return 'Template name is required.';
        if (!formData.items.length) return 'At least one checklist item is required.';
        if (formData.items.some((item) => !item.title?.trim())) return 'Each checklist item must have a title.';
        return null;
    }, [formData]);

    const onSubmit = async (event) => {
        event.preventDefault();
        if (validationError) {
            toast.error('Validation error', validationError);
            return;
        }

        const payload = {
            name: formData.name.trim(),
            description: formData.description?.trim() || undefined,
            isActive: formData.isActive,
            items: formData.items.map((item, index) => ({
                title: item.title.trim(),
                description: item.description?.trim() || undefined,
                isRequired: item.isRequired !== false,
                orderIndex: index
            }))
        };

        try {
            if (isEdit) {
                await updateMutation.mutateAsync({ id: templateId, data: payload });
                toast.success('Checklist updated', 'Template saved successfully.');
            } else {
                await createMutation.mutateAsync(payload);
                toast.success('Checklist created', 'Template created successfully.');
            }
            onClose();
        } catch (error) {
            toast.error('Failed to save checklist', error.message || 'Unknown error');
        }
    };

    const onDeactivate = async () => {
        if (!templateId) return;
        if (!window.confirm('Deactivate this checklist template?')) return;

        try {
            await deactivateMutation.mutateAsync(templateId);
            toast.success('Checklist deactivated', 'Template marked inactive.');
            onClose();
        } catch (error) {
            toast.error('Failed to deactivate checklist', error.message || 'Unknown error');
        }
    };

    if (isEdit && isLoading) {
        return <div>Loading checklist template...</div>;
    }

    return (
        <form onSubmit={onSubmit} className="cycle-config-form">
            <h2>{isEdit ? 'Edit Checklist Template' : 'Create Checklist Template'}</h2>

            <div className="form-group">
                <label>Name</label>
                <input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                    maxLength={100}
                    required
                />
            </div>

            <div className="form-group">
                <label>Description</label>
                <textarea
                    className="form-control"
                    rows={3}
                    maxLength={500}
                    value={formData.description}
                    onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                />
            </div>

            <div className="form-group form-checkbox">
                <label>
                    <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(event) => setFormData((prev) => ({ ...prev, isActive: event.target.checked }))}
                    />
                    Active
                </label>
            </div>

            <ChecklistItemEditor
                items={formData.items}
                onChange={(items) => setFormData((prev) => ({ ...prev, items }))}
            />

            {validationError && (
                <p style={{ color: '#b42318', marginTop: '0.75rem' }}>{validationError}</p>
            )}

            <div className="form-actions">
                {isEdit && (
                    <button type="button" className="btn-danger" onClick={onDeactivate} disabled={busy}>
                        Deactivate
                    </button>
                )}
                <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
                    Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                    {isEdit ? 'Update' : 'Create'}
                </button>
            </div>
        </form>
    );
};

export default ChecklistTemplateForm;
