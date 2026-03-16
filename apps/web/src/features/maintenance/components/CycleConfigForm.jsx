
import React, { useState, useEffect } from 'react';
import { useCreateCycle, useUpdateCycle, useDeactivateCycle, useChecklistTemplates } from "../hooks/useMaintenance.js";
import { useToast } from '../../../shared/hooks/useToast.js';
import './CycleConfigForm.css';

const CycleConfigForm = ({ cycle, onClose }) => {
    const isEdit = !!cycle;
    // Default form data
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        intervalMonths: 3,
        isActive: true,
        defaultChecklistTemplateId: ''
    });

    // Initialize if editing
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

    // Hooks
    const createCycle = useCreateCycle();
    const updateCycle = useUpdateCycle();
    const deactivateCycle = useDeactivateCycle();
    const { data: checklistTemplates = [] } = useChecklistTemplates(false);
    const toast = useToast();
    const isSaving = createCycle.isPending || updateCycle.isPending || deactivateCycle.isPending;

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const payload = {
                ...formData,
                defaultChecklistTemplateId: formData.defaultChecklistTemplateId || undefined
            };
            if (isEdit) {
                await updateCycle.mutateAsync({ id: cycle.id, data: payload });
                toast.success('Cycle updated', `"${payload.name}" has been updated.`);
            } else {
                await createCycle.mutateAsync(payload);
                toast.success('Cycle created', `"${payload.name}" has been created.`);
            }
            onClose();
        } catch (error) {
            toast.error('Failed to save cycle', error.message || 'Unable to save maintenance cycle.');
        }
    };

    const handleDeactivate = async () => {
        if (!window.confirm('Are you sure you want to deactivate this cycle?')) return;

        try {
            await deactivateCycle.mutateAsync(cycle.id);
            toast.success('Cycle deactivated', `"${cycle.name}" is now inactive.`);
            onClose();
        } catch (error) {
            toast.error('Failed to deactivate cycle', error.message || 'Unable to deactivate maintenance cycle.');
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (name === 'intervalMonths' ? Number.parseInt(value, 10) : value)
        }));
    };

    return (
        <div className="cycle-config-form" aria-busy={isSaving}>
            <h2>{isEdit ? 'Edit Maintenance Cycle' : 'Create New Maintenance Cycle'}</h2>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Name</label>
                    <input
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
                    <label>Description</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        className="form-control"
                        rows={3}
                        maxLength={500}
                    />
                </div>

                <div className="form-group">
                    <label>Interval (Months)</label>
                    <input
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
                    <label>Default Checklist (Optional)</label>
                    <select
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
                            Is Active
                        </label>
                    </div>
                )}

                <div className="form-actions">
                    {isEdit && (
                        <button type="button" onClick={handleDeactivate} className="btn-danger" disabled={isSaving}>
                            Deactivate
                        </button>
                    )}
                    <button type="button" onClick={onClose} className="btn-secondary" disabled={isSaving}>
                        Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={isSaving}>
                        {isSaving ? 'Saving...' : (isEdit ? 'Update' : 'Create')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CycleConfigForm;
