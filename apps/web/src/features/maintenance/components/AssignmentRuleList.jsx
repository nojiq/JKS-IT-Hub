import React from 'react';
import { formatDisplayDate } from '../../../shared/utils/date-format.js';
import './CycleConfigForm.css';
import './AssignmentRuleList.css';

const AssignmentRuleList = ({ rules = [], onEdit, onDeactivate, onResetRotation }) => {
    if (!rules || rules.length === 0) {
        return <div className="assignment-rule-list-empty">No assignment rules found.</div>;
    }

    return (
        <table className="assignment-rule-list-table">
            <thead>
                <tr>
                    <th>Department</th>
                    <th>Strategy</th>
                    <th>PICs</th>
                    <th>Current Rotation</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {rules.map(rule => (
                    <tr key={rule.id}>
                        <td>{rule.department}</td>
                        <td>
                            <span className={`strategy-badge ${rule.assignmentStrategy.toLowerCase()}`}>
                                {rule.assignmentStrategy === 'FIXED' ? 'Fixed' : 'Rotation'}
                            </span>
                        </td>
                        <td>
                            {rule.technicians?.length || 0} PIC(s)
                        </td>
                        <td>
                            {rule.assignmentStrategy === 'ROTATION' && rule.rotationState ? (
                                <span className="rotation-info">
                                    Index: {rule.rotationState.currentTechnicianIndex}
                                    {rule.rotationState.lastAssignedAt && (
                                        <span className="last-assigned">
                                            {' '}(Last: {formatDisplayDate(rule.rotationState.lastAssignedAt)})
                                        </span>
                                    )}
                                </span>
                            ) : (
                                <span className="rotation-info-na">N/A</span>
                            )}
                        </td>
                        <td>
                            <span className={`status-badge ${rule.isActive ? 'active' : 'inactive'}`}>
                                {rule.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td className="actions-cell">
                            <button
                                type="button"
                                onClick={() => onEdit(rule)}
                                className="workspace-inline-button"
                                title="Edit rule"
                            >
                                Edit
                            </button>
                            {rule.assignmentStrategy === 'ROTATION' && rule.isActive && (
                                <button
                                    type="button"
                                    onClick={() => onResetRotation(rule)}
                                    className="workspace-inline-button"
                                    title="Reset rotation to first PIC"
                                >
                                    Reset rotation
                                </button>
                            )}
                            {rule.isActive && (
                                <button
                                    type="button"
                                    onClick={() => onDeactivate(rule)}
                                    className="workspace-inline-button cycle-config-form__btn-danger"
                                    title="Deactivate rule"
                                >
                                    Deactivate
                                </button>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default AssignmentRuleList;
