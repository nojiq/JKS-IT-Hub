import React, { useEffect, useMemo, useState } from 'react';
import {
    useChecklistTemplate,
    useCreateChecklistTemplate,
    useUpdateChecklistTemplate,
    useDeactivateChecklistTemplate,
    useDeleteChecklistTemplate
} from '../hooks/useMaintenance.js';
import { useToast } from '../../../shared/hooks/useToast.js';
import ChecklistItemEditor from './ChecklistItemEditor.jsx';
import './CycleConfigForm.css';
import './ChecklistTemplateForm.css';

const ChecklistTemplateForm = ({ templateId, onClose, variant = 'default' }) => {
    const isEdit = Boolean(templateId);
    const isModal = variant === 'modal';
    const { data: loadedTemplate, isLoading } = useChecklistTemplate(templateId);
    const createMutation = useCreateChecklistTemplate();
    const updateMutation = useUpdateChecklistTemplate();
    const deactivateMutation = useDeactivateChecklistTemplate();
    const deleteMutation = useDeleteChecklistTemplate();
    const toast = useToast();
    const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        isActive: true,
        items: []
    });

    const busy = createMutation.isPending || updateMutation.isPending || deactivateMutation.isPending || deleteMutation.isPending;

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

    useEffect(() => {
        setShowDeactivateConfirm(false);
        setShowDeleteConfirm(false);
    }, [templateId]);

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

    const handleDeactivateConfirmed = async () => {
        if (!templateId) return;
        try {
            await deactivateMutation.mutateAsync(templateId);
            toast.success('Checklist deactivated', 'Template marked inactive.');
            setShowDeactivateConfirm(false);
            onClose();
        } catch (error) {
            toast.error('Failed to deactivate checklist', error.message || 'Unknown error');
        }
    };

    const handleDeleteConfirmed = async () => {
        if (!templateId) return;
        try {
            await deleteMutation.mutateAsync(templateId);
            toast.success('Checklist deleted', 'Template permanently deleted.');
            setShowDeleteConfirm(false);
            onClose();
        } catch (error) {
            toast.error('Failed to delete checklist', error.message || 'Unknown error');
        }
    };

    const rootClass = ['cycle-config-form', 'checklist-template-form', isModal && 'cycle-config-form--modal']
        .filter(Boolean)
        .join(' ');

    if (isEdit && isLoading) {
        return (
            <div className={`${rootClass} checklist-template-form--loading-root`} aria-busy="true">
                <div className="checklist-template-form__loading">Loading checklist template…</div>
            </div>
        );
    }

    return (
        <form onSubmit={onSubmit} className={rootClass} aria-busy={busy}>
            {!isModal ? (
                <h2>{isEdit ? 'Edit Checklist Template' : 'Create Checklist Template'}</h2>
            ) : null}

            <div className="checklist-template-form__scroll">
                <div className="cycle-config-form__fields">
                    <div className="form-group">
                        <label htmlFor="checklist-template-name">Name</label>
                        <input
                            id="checklist-template-name"
                            type="text"
                            className="form-control"
                            value={formData.name}
                            onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                            maxLength={100}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="checklist-template-description">Description</label>
                        <textarea
                            id="checklist-template-description"
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
                </div>

                <ChecklistItemEditor
                    items={formData.items}
                    onChange={(items) => setFormData((prev) => ({ ...prev, items }))}
                />

                {validationError ? (
                    <p className="checklist-template-form__validation" role="alert">
                        {validationError}
                    </p>
                ) : null}
            </div>

            {isEdit && showDeactivateConfirm ? (
                <div className="checklist-deactivate-confirm" role="alert">
                    <p className="checklist-deactivate-confirm__title">Deactivate this template?</p>
                    <p className="checklist-deactivate-confirm__text">
                        <strong>{formData.name || 'This template'}</strong> will be marked inactive and hidden from new
                        assignments.
                    </p>
                    <div className="checklist-deactivate-confirm__actions">
                        <button
                            type="button"
                            className="workspace-inline-button"
                            onClick={() => setShowDeactivateConfirm(false)}
                            disabled={busy}
                        >
                            Back
                        </button>
                        <button
                            type="button"
                            className="workspace-inline-button checklist-template-form__btn-danger"
                            onClick={handleDeactivateConfirmed}
                            disabled={busy}
                        >
                            {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate template'}
                        </button>
                    </div>
                </div>
            ) : null}

            {isEdit && showDeleteConfirm ? (
                <div className="checklist-deactivate-confirm" role="alert">
                    <p className="checklist-deactivate-confirm__title">Delete this template?</p>
                    <p className="checklist-deactivate-confirm__text">
                        <strong>{formData.name || 'This template'}</strong> will be permanently deleted. Existing
                        windows keep their checklist snapshots.
                    </p>
                    <div className="checklist-deactivate-confirm__actions">
                        <button
                            type="button"
                            className="workspace-inline-button"
                            onClick={() => setShowDeleteConfirm(false)}
                            disabled={busy}
                        >
                            Back
                        </button>
                        <button
                            type="button"
                            className="workspace-inline-button checklist-template-form__btn-danger"
                            onClick={handleDeleteConfirmed}
                            disabled={busy}
                        >
                            {deleteMutation.isPending ? 'Deleting…' : 'Delete template'}
                        </button>
                    </div>
                </div>
            ) : null}

            <footer className="checklist-template-form__footer">
                <div className="checklist-template-form__footer-start">
                    {isEdit && !showDeactivateConfirm && !showDeleteConfirm ? (
                        <div className="checklist-template-form__danger-actions">
                            <button
                                type="button"
                                className="workspace-inline-button checklist-template-form__btn-warning"
                                onClick={() => setShowDeactivateConfirm(true)}
                                disabled={busy}
                            >
                                Deactivate
                            </button>
                            <button
                                type="button"
                                className="workspace-inline-button checklist-template-form__btn-danger"
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={busy}
                            >
                                Delete
                            </button>
                        </div>
                    ) : null}
                </div>
                <div className="checklist-template-form__footer-end">
                    <button type="button" className="workspace-inline-button" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button type="submit" className="workspace-inline-button is-primary" disabled={busy}>
                        {createMutation.isPending || updateMutation.isPending
                            ? 'Saving…'
                            : isEdit
                              ? 'Save changes'
                              : 'Create template'}
                    </button>
                </div>
            </footer>
        </form>
    );
};

export default ChecklistTemplateForm;
