import React from 'react';
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
                    <th>Technicians</th>
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
                            {rule.technicians?.length || 0} technician(s)
                        </td>
                        <td>
                            {rule.assignmentStrategy === 'ROTATION' && rule.rotationState ? (
                                <span className="rotation-info">
                                    Index: {rule.rotationState.currentTechnicianIndex}
                                    {rule.rotationState.lastAssignedAt && (
                                        <span className="last-assigned">
                                            {' '}(Last: {new Date(rule.rotationState.lastAssignedAt).toLocaleDateString()})
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
                            <button onClick={() => onEdit(rule)} className="btn-secondary" title="Edit rule">
                                Edit
                            </button>
                            {rule.assignmentStrategy === 'ROTATION' && rule.isActive && (
                                <button
                                    onClick={() => onResetRotation(rule.id)}
                                    className="btn-tertiary"
                                    title="Reset rotation to first technician"
                                >
                                    Reset Rotation
                                </button>
                            )}
                            {rule.isActive && (
                                <button
                                    onClick={() => onDeactivate(rule.id)}
                                    className="btn-danger"
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
