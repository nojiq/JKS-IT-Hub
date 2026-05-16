import React, { useState, useEffect } from 'react';
import { useCreateAssignmentRule, useUpdateAssignmentRule } from '../hooks/useMaintenance.js';
import { fetchUsers } from '../../users/users-api.js';
import { useToast } from '../../../shared/hooks/useToast.js';
import './CycleConfigForm.css';
import './AssignmentRuleForm.css';

function IconChevronDown() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden>
            <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
            />
        </svg>
    );
}

function IconChevronUp() {
    return (
        <span className="assignment-rule-form__flip-y" aria-hidden>
            <IconChevronDown />
        </span>
    );
}

function IconX() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden>
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
    );
}

const AssignmentRuleForm = ({ rule = null, onClose, variant = 'default' }) => {
    const isModal = variant === 'modal';
    const toast = useToast();
    const [formData, setFormData] = useState({
        department: '',
        assignmentStrategy: 'FIXED',
        technicianIds: [],
        isActive: true
    });
    const [errors, setErrors] = useState({});
    const [availableTechnicians, setAvailableTechnicians] = useState([]);
    const [selectedTechnicians, setSelectedTechnicians] = useState([]);
    const [isLoadingTechnicians, setIsLoadingTechnicians] = useState(true);

    const createMutation = useCreateAssignmentRule();
    const updateMutation = useUpdateAssignmentRule();

    useEffect(() => {
        const loadTechnicians = async () => {
            try {
                setIsLoadingTechnicians(true);
                const result = await fetchUsers({ role: 'it', status: 'active' });
                const techniciansList = result.users || result || [];
                setAvailableTechnicians(techniciansList);
            } catch (error) {
                console.error('Failed to load technicians:', error);
                setErrors({ technicians: 'Failed to load IT staff' });
            } finally {
                setIsLoadingTechnicians(false);
            }
        };
        loadTechnicians();
    }, []);

    useEffect(() => {
        if (rule) {
            setFormData({
                department: rule.department || '',
                assignmentStrategy: rule.assignmentStrategy || 'FIXED',
                technicianIds: rule.technicians?.map((t) => t.userId) || [],
                isActive: rule.isActive ?? true
            });

            if (rule.technicians) {
                setSelectedTechnicians(
                    rule.technicians
                        .map((t) => ({
                            id: t.userId,
                            displayName: t.user?.displayName || 'Unknown',
                            orderIndex: t.orderIndex
                        }))
                        .sort((a, b) => a.orderIndex - b.orderIndex)
                );
            }
        } else {
            setFormData({
                department: '',
                assignmentStrategy: 'FIXED',
                technicianIds: [],
                isActive: true
            });
            setSelectedTechnicians([]);
            setErrors({});
        }
    }, [rule]);

    const validateForm = () => {
        const newErrors = {};

        if (!formData.department.trim()) {
            newErrors.department = 'Department is required';
        }

        if (formData.technicianIds.length === 0) {
            newErrors.technicians = 'At least one PIC is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        const payload = {
            department: formData.department,
            assignmentStrategy: formData.assignmentStrategy,
            technicianIds: selectedTechnicians.map((t) => t.id),
            isActive: formData.isActive
        };

        try {
            if (rule) {
                await updateMutation.mutateAsync({ id: rule.id, data: payload });
                toast.success('Rule updated', 'Assignment rule saved.');
            } else {
                await createMutation.mutateAsync(payload);
                toast.success('Rule created', 'Assignment rule created.');
            }
            onClose();
        } catch (error) {
            setErrors({ submit: error.message });
        }
    };

    const handleAddTechnician = (technicianId) => {
        const technician = availableTechnicians.find((t) => t.id === technicianId);
        if (!technician) return;

        if (selectedTechnicians.some((t) => t.id === technicianId)) {
            return;
        }

        setSelectedTechnicians([
            ...selectedTechnicians,
            {
                id: technician.id,
                displayName: technician.displayName || technician.username,
                orderIndex: selectedTechnicians.length
            }
        ]);
        setFormData({
            ...formData,
            technicianIds: [...formData.technicianIds, technicianId]
        });
    };

    const handleRemoveTechnician = (technicianId) => {
        const newSelected = selectedTechnicians
            .filter((t) => t.id !== technicianId)
            .map((t, index) => ({ ...t, orderIndex: index }));

        setSelectedTechnicians(newSelected);
        setFormData({
            ...formData,
            technicianIds: newSelected.map((t) => t.id)
        });
    };

    const handleMoveTechnician = (index, direction) => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= selectedTechnicians.length) return;

        const newSelected = [...selectedTechnicians];
        [newSelected[index], newSelected[newIndex]] = [newSelected[newIndex], newSelected[index]];
        newSelected.forEach((t, i) => {
            t.orderIndex = i;
        });

        setSelectedTechnicians(newSelected);
        setFormData({
            ...formData,
            technicianIds: newSelected.map((t) => t.id)
        });
    };

    const unselectedTechnicians = availableTechnicians.filter(
        (t) => !selectedTechnicians.some((st) => st.id === t.id)
    );

    const saving = createMutation.isPending || updateMutation.isPending;

    const rootClass = ['assignment-rule-form', 'cycle-config-form', isModal && 'cycle-config-form--modal']
        .filter(Boolean)
        .join(' ');

    return (
        <form
            onSubmit={handleSubmit}
            className={rootClass}
            aria-busy={saving}
            data-variant={variant}
        >
            {!isModal ? <h2 className="assignment-rule-form__page-title">{rule ? 'Edit Assignment Rule' : 'Create Assignment Rule'}</h2> : null}

            <div className="assignment-rule-form__scroll">
                <div className="cycle-config-form__fields">
                    <div className="form-group">
                        <label htmlFor="department">
                            Department <span className="assignment-rule-form__req">*</span>
                        </label>
                        <input
                            type="text"
                            id="department"
                            className="form-control"
                            value={formData.department}
                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                            placeholder="e.g. IT Support, Engineering"
                            maxLength={100}
                            disabled={Boolean(rule)}
                        />
                        {errors.department ? <span className="assignment-rule-form__error">{errors.department}</span> : null}
                    </div>

                    <div className="form-group">
                        <label htmlFor="assignmentStrategy">
                            Assignment strategy <span className="assignment-rule-form__req">*</span>
                        </label>
                        <select
                            id="assignmentStrategy"
                            className="form-control"
                            value={formData.assignmentStrategy}
                            onChange={(e) => setFormData({ ...formData, assignmentStrategy: e.target.value })}
                        >
                            <option value="FIXED">Fixed — always assign to first PIC</option>
                            <option value="ROTATION">Rotation — round-robin across PICs</option>
                        </select>
                    </div>

                    <div className="form-group form-checkbox">
                        <label>
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                            />
                            Active
                        </label>
                    </div>
                </div>

                <div className="form-group assignment-rule-form__pics-section">
                    <p className="assignment-rule-form__section-label" id="pics-label">
                        PICs <span className="assignment-rule-form__req">*</span>
                    </p>

                    {isLoadingTechnicians ? (
                        <p className="assignment-rule-form__muted">Loading IT staff…</p>
                    ) : (
                        <>
                            {selectedTechnicians.length > 0 ? (
                                <div className="assignment-rule-form__selected" role="list" aria-labelledby="pics-label">
                                    <p className="assignment-rule-form__selected-hint">
                                        Order: {formData.assignmentStrategy === 'ROTATION' ? 'rotation' : 'first only'}
                                    </p>
                                    <ul className="assignment-rule-form__tech-list">
                                        {selectedTechnicians.map((tech, index) => (
                                            <li key={tech.id} className="assignment-rule-form__tech-card" role="listitem">
                                                <span className="assignment-rule-form__tech-index">{index + 1}</span>
                                                <span className="assignment-rule-form__tech-name">{tech.displayName}</span>
                                                <div className="assignment-rule-form__tech-actions">
                                                    <button
                                                        type="button"
                                                        className="assignment-rule-form__icon-btn"
                                                        onClick={() => handleMoveTechnician(index, 'up')}
                                                        disabled={index === 0}
                                                        aria-label={`Move ${tech.displayName} up`}
                                                    >
                                                        <IconChevronUp />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="assignment-rule-form__icon-btn"
                                                        onClick={() => handleMoveTechnician(index, 'down')}
                                                        disabled={index === selectedTechnicians.length - 1}
                                                        aria-label={`Move ${tech.displayName} down`}
                                                    >
                                                        <IconChevronDown />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="assignment-rule-form__remove-btn"
                                                        onClick={() => handleRemoveTechnician(tech.id)}
                                                        aria-label={`Remove ${tech.displayName}`}
                                                    >
                                                        <IconX />
                                                        <span className="assignment-rule-form__remove-label">Remove</span>
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}

                            {unselectedTechnicians.length > 0 ? (
                                <div className="assignment-rule-form__add-wrap">
                                    <select
                                        id="add-pic-select"
                                        className="form-control"
                                        aria-label="Add a PIC to this rule"
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleAddTechnician(e.target.value);
                                                e.target.value = '';
                                            }
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="">Add PIC…</option>
                                        {unselectedTechnicians.map((tech) => (
                                            <option key={tech.id} value={tech.id}>
                                                {tech.displayName || tech.username}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : null}

                            {unselectedTechnicians.length === 0 && selectedTechnicians.length === 0 ? (
                                <p className="assignment-rule-form__muted">No IT staff available.</p>
                            ) : null}

                            {errors.technicians ? (
                                <span className="assignment-rule-form__error">{errors.technicians}</span>
                            ) : null}
                        </>
                    )}
                </div>

                {errors.submit ? <div className="assignment-rule-form__submit-error">{errors.submit}</div> : null}
            </div>

            <footer className="assignment-rule-form__footer">
                <div className="assignment-rule-form__footer-end">
                    <button type="button" className="workspace-inline-button" onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button type="submit" className="workspace-inline-button is-primary" disabled={saving}>
                        {saving ? 'Saving…' : rule ? 'Save changes' : 'Create rule'}
                    </button>
                </div>
            </footer>
        </form>
    );
};

export default AssignmentRuleForm;
