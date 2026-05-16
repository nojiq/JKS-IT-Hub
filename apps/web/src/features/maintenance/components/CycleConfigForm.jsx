
import React, { useState, useEffect } from 'react';
import { useCreateCycle, useUpdateCycle, useDeactivateCycle, useChecklistTemplates } from "../hooks/useMaintenance.js";
import { useToast } from '../../../shared/hooks/useToast.js';
import './CycleConfigForm.css';

const CycleConfigForm = ({ cycle, onClose, variant = 'default' }) => {
    const isEdit = !!cycle;
    const isModal = variant === 'modal';
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        intervalMonths: 3,
        isActive: true,
        defaultChecklistTemplateId: ''
    });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (cycle) {
            setFormData({
                name: cycle.name || '',
                description: cycle.description || '',
                intervalMonths: cycle.intervalMonths || 3,
                isActive: cycle.isActive !== undefined ? cycle.isActive : true,
                defaultChecklistTemplateId: cycle.defaultChecklistTemplateId || ''
            });
        }
    }, [cycle]);

    useEffect(() => {
        setShowDeleteConfirm(false);
    }, [cycle?.id]);

    const createCycle = useCreateCycle();
    const updateCycle = useUpdateCycle();
    const deleteCycleMutation = useDeactivateCycle();
    const { data: checklistTemplates = [] } = useChecklistTemplates(false);
    const toast = useToast();
    const isSaving = createCycle.isPending || updateCycle.isPending || deleteCycleMutation.isPending;

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const payload = {
                ...formData,
                defaultChecklistTemplateId: formData.defaultChecklistTemplateId || undefined
            };
            if (isEdit) {
                await updateCycle.mutateAsync({ id: cycle.id, data: payload });
                toast.success('Policy updated', `"${payload.name}" has been updated.`);
            } else {
                await createCycle.mutateAsync(payload);
                toast.success('Policy created', `"${payload.name}" has been created.`);
            }
            onClose();
        } catch (error) {
            toast.error('Failed to save cycle', error.message || 'Unable to save maintenance cycle.');
        }
    };

    const handleDeleteConfirmed = async () => {
        if (!cycle) return;
        try {
            await deleteCycleMutation.mutateAsync(cycle.id);
            toast.success('Cycle deleted', `"${cycle.name}" was removed.`);
            setShowDeleteConfirm(false);
            onClose();
        } catch (error) {
            toast.error('Failed to delete cycle', error.message || 'Unable to delete maintenance cycle.');
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (name === 'intervalMonths' ? Number.parseInt(value, 10) : value)
        }));
    };

    const rootClass = ['cycle-config-form', isModal && 'cycle-config-form--modal'].filter(Boolean).join(' ');

    return (
        <div className={rootClass} aria-busy={isSaving}>
            {!isModal ? (
                <h2>{isEdit ? 'Edit maintenance policy' : 'Create maintenance policy'}</h2>
            ) : null}

            <form onSubmit={handleSubmit}>
                <div className="cycle-config-form__fields">
                    <div className="form-group">
                        <label htmlFor="cycle-name">Name</label>
                        <input
                            id="cycle-name"
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="form-control"
                            required
                            minLength={1}
                            maxLength={100}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="cycle-description">Description</label>
                        <textarea
                            id="cycle-description"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            className="form-control"
                            rows={3}
                            maxLength={500}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="cycle-interval">Interval (months)</label>
                        <input
                            id="cycle-interval"
                            type="number"
                            name="intervalMonths"
                            value={formData.intervalMonths}
                            onChange={handleChange}
                            className="form-control"
                            min={1}
                            max={24}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="cycle-checklist">Default checklist (optional)</label>
                        <select
                            id="cycle-checklist"
                            name="defaultChecklistTemplateId"
                            value={formData.defaultChecklistTemplateId}
                            onChange={handleChange}
                            className="form-control"
                        >
                            <option value="">None</option>
                            {checklistTemplates.map((template) => (
                                <option key={template.id} value={template.id}>
                                    {template.name} ({template._count?.items ?? template.items?.length ?? 0} items)
                                </option>
                            ))}
                        </select>
                    </div>

                    {isEdit && (
                        <div className="form-group form-checkbox">
                            <label>
                                <input
                                    type="checkbox"
                                    name="isActive"
                                    checked={formData.isActive}
                                    onChange={handleChange}
                                />
                                Active
                            </label>
                        </div>
                    )}
                </div>

                {isEdit && showDeleteConfirm ? (
                    <div className="cycle-config-delete-confirm" role="alert">
                        <p className="cycle-config-delete-confirm__title">Delete this cycle?</p>
                        <p className="cycle-config-delete-confirm__text">
                            <strong>{cycle.name}</strong> will be permanently removed. This cannot be undone.
                        </p>
                        <div className="cycle-config-delete-confirm__actions">
                            <button
                                type="button"
                                className="workspace-inline-button"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isSaving}
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                className="workspace-inline-button cycle-config-form__btn-danger"
                                onClick={handleDeleteConfirmed}
                                disabled={isSaving}
                            >
                                {deleteCycleMutation.isPending ? 'Deleting…' : 'Delete cycle'}
                            </button>
                        </div>
                    </div>
                ) : null}

                <footer className="cycle-config-form__footer">
                    <div className="cycle-config-form__footer-start">
                        {isEdit && !showDeleteConfirm ? (
                            <button
                                type="button"
                                className="workspace-inline-button cycle-config-form__btn-danger"
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isSaving}
                            >
                                Delete
                            </button>
                        ) : null}
                    </div>
                    <div className="cycle-config-form__footer-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="workspace-inline-button"
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="workspace-inline-button is-primary"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create cycle')}
                        </button>
                    </div>
                </footer>
            </form>
        </div>
    );
};

export default CycleConfigForm;
