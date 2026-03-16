import React, { useState, useEffect } from 'react';
import { useCreateAssignmentRule, useUpdateAssignmentRule } from '../hooks/useMaintenance.js';
import { fetchUsers } from '../../users/users-api.js';
import './AssignmentRuleForm.css';

const AssignmentRuleForm = ({ rule = null, onClose }) => {
    const [formData, setFormData] = useState({
        department: '',
        assignmentStrategy: 'FIXED',
        technicianIds: [],
        isActive: true,
    });
    const [errors, setErrors] = useState({});
    const [availableTechnicians, setAvailableTechnicians] = useState([]);
    const [selectedTechnicians, setSelectedTechnicians] = useState([]);
    const [isLoadingTechnicians, setIsLoadingTechnicians] = useState(true);

    const createMutation = useCreateAssignmentRule();
    const updateMutation = useUpdateAssignmentRule();

    // Load IT staff on mount
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

    // Pre-fill form when editing
    useEffect(() => {
        if (rule) {
            setFormData({
                department: rule.department || '',
                assignmentStrategy: rule.assignmentStrategy || 'FIXED',
                technicianIds: rule.technicians?.map(t => t.userId) || [],
                isActive: rule.isActive ?? true,
            });

            if (rule.technicians) {
                setSelectedTechnicians(
                    rule.technicians.map(t => ({
                        id: t.userId,
                        displayName: t.user?.displayName || 'Unknown',
                        orderIndex: t.orderIndex,
                    })).sort((a, b) => a.orderIndex - b.orderIndex)
                );
            }
        }
    }, [rule]);

    const validateForm = () => {
        const newErrors = {};

        if (!formData.department.trim()) {
            newErrors.department = 'Department is required';
        }

        if (formData.technicianIds.length === 0) {
            newErrors.technicians = 'At least one technician is required';
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
            technicianIds: selectedTechnicians.map(t => t.id),
            isActive: formData.isActive,
        };

        try {
            if (rule) {
                await updateMutation.mutateAsync({ id: rule.id, data: payload });
            } else {
                await createMutation.mutateAsync(payload);
            }
            onClose();
        } catch (error) {
            setErrors({ submit: error.message });
        }
    };

    const handleAddTechnician = (technicianId) => {
        const technician = availableTechnicians.find(t => t.id === technicianId);
        if (!technician) return;

        if (selectedTechnicians.some(t => t.id === technicianId)) {
            return; // Already selected
        }

        setSelectedTechnicians([
            ...selectedTechnicians,
            {
                id: technician.id,
                displayName: technician.displayName || technician.username,
                orderIndex: selectedTechnicians.length,
            },
        ]);
        setFormData({
            ...formData,
            technicianIds: [...formData.technicianIds, technicianId],
        });
    };

    const handleRemoveTechnician = (technicianId) => {
        const newSelected = selectedTechnicians
            .filter(t => t.id !== technicianId)
            .map((t, index) => ({ ...t, orderIndex: index }));

        setSelectedTechnicians(newSelected);
        setFormData({
            ...formData,
            technicianIds: newSelected.map(t => t.id),
        });
    };

    const handleMoveTechnician = (index, direction) => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= selectedTechnicians.length) return;

        const newSelected = [...selectedTechnicians];
        [newSelected[index], newSelected[newIndex]] = [newSelected[newIndex], newSelected[index]];
        newSelected.forEach((t, i) => (t.orderIndex = i));

        setSelectedTechnicians(newSelected);
        setFormData({
            ...formData,
            technicianIds: newSelected.map(t => t.id),
        });
    };

    const unselectedTechnicians = availableTechnicians.filter(
        t => !selectedTechnicians.some(st => st.id === t.id)
    );

    return (
        <div className="assignment-rule-form">
            <h2>{rule ? 'Edit Assignment Rule' : 'Create Assignment Rule'}</h2>

            <form onSubmit={handleSubmit}>
                {/* Department Field */}
                <div className="form-group">
                    <label htmlFor="department">
                        Department <span className="required">*</span>
                    </label>
                    <input
                        type="text"
                        id="department"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        placeholder="e.g., IT Support, Engineering"
                        maxLength={100}
                        disabled={!!rule} // Cannot change department when editing
                    />
                    {errors.department && <span className="error">{errors.department}</span>}
                </div>

                {/* Assignment Strategy Field */}
                <div className="form-group">
                    <label htmlFor="assignmentStrategy">
                        Assignment Strategy <span className="required">*</span>
                    </label>
                    <select
                        id="assignmentStrategy"
                        value={formData.assignmentStrategy}
                        onChange={(e) => setFormData({ ...formData, assignmentStrategy: e.target.value })}
                    >
                        <option value="FIXED">Fixed - Always assign to first technician</option>
                        <option value="ROTATION">Rotation - Round-robin assignment</option>
                    </select>
                </div>

                {/* Active Status Toggle */}
                <div className="form-group">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        />
                        <span>Active</span>
                    </label>
                </div>

                {/* Technician Selector */}
                <div className="form-group">
                    <label>
                        Technicians <span className="required">*</span>
                    </label>

                    {isLoadingTechnicians ? (
                        <p className="loading-text">Loading IT staff...</p>
                    ) : (
                        <>
                            {/* Selected Technicians List */}
                            {selectedTechnicians.length > 0 && (
                                <div className="selected-technicians">
                                    <h4>Selected Technicians (Order: {formData.assignmentStrategy === 'ROTATION' ? 'Rotation' : 'First Only'})</h4>
                                    <ul className="technician-list">
                                        {selectedTechnicians.map((tech, index) => (
                                            <li key={tech.id} className="technician-item">
                                                <span className="order-index">{index + 1}</span>
                                                <span className="technician-name">{tech.displayName}</span>
                                                <div className="technician-actions">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveTechnician(index, 'up')}
                                                        disabled={index === 0}
                                                        className="btn-icon"
                                                        title="Move up"
                                                    >
                                                        ↑
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveTechnician(index, 'down')}
                                                        disabled={index === selectedTechnicians.length - 1}
                                                        className="btn-icon"
                                                        title="Move down"
                                                    >
                                                        ↓
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveTechnician(tech.id)}
                                                        className="btn-remove"
                                                        title="Remove"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Available Technicians Dropdown */}
                            {unselectedTechnicians.length > 0 && (
                                <div className="add-technician">
                                    <select
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleAddTechnician(e.target.value);
                                                e.target.value = '';
                                            }
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="">-- Add Technician --</option>
                                        {unselectedTechnicians.map(tech => (
                                            <option key={tech.id} value={tech.id}>
                                                {tech.displayName || tech.username}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {unselectedTechnicians.length === 0 && selectedTechnicians.length === 0 && (
                                <p className="no-technicians">No IT staff available</p>
                            )}

                            {errors.technicians && <span className="error">{errors.technicians}</span>}
                        </>
                    )}
                </div>

                {/* Error Display */}
                {errors.submit && <div className="submit-error">{errors.submit}</div>}

                {/* Form Actions */}
                <div className="form-actions">
                    <button type="button" onClick={onClose} className="btn-secondary">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={createMutation.isPending || updateMutation.isPending}
                    >
                        {createMutation.isPending || updateMutation.isPending
                            ? 'Saving...'
                            : rule
                                ? 'Update Rule'
                                : 'Create Rule'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AssignmentRuleForm;
