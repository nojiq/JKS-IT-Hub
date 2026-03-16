import React, { useState, useEffect } from 'react';
import { useManuallyAssignWindow } from '../hooks/useMaintenance.js';
import { fetchUsers } from '../../users/users-api.js';
import './ManualAssignmentModal.css';

const ManualAssignmentModal = ({ window, onClose }) => {
    const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
    const [technicians, setTechnicians] = useState([]);
    const [isLoadingTechnicians, setIsLoadingTechnicians] = useState(true);
    const [error, setError] = useState(null);

    const assignMutation = useManuallyAssignWindow();

    useEffect(() => {
        const loadTechnicians = async () => {
            try {
                setIsLoadingTechnicians(true);
                const result = await fetchUsers({ role: 'it', status: 'active' });
                const techniciansList = result.users || result || [];
                setTechnicians(techniciansList);

                // Pre-select current assignee if exists
                if (window.assignedToId) {
                    setSelectedTechnicianId(window.assignedToId);
                }
            } catch (err) {
                console.error('Failed to load technicians:', err);
                setError('Failed to load IT staff');
            } finally {
                setIsLoadingTechnicians(false);
            }
        };
        loadTechnicians();
    }, [window.assignedToId]);

    const handleAssign = async (e) => {
        e.preventDefault();

        if (!selectedTechnicianId) {
            setError('Please select a technician');
            return;
        }

        try {
            await assignMutation.mutateAsync({
                windowId: window.id,
                userId: selectedTechnicianId,
            });
            onClose(true); // Close with success
        } catch (err) {
            setError(err.message || 'Failed to assign window');
        }
    };

    return (
        <div className="modal-overlay" onClick={() => onClose(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{window.assignedTo ? 'Reassign' : 'Assign'} Maintenance Window</h3>
                    <button className="modal-close" onClick={() => onClose(false)}>✕</button>
                </div>

                <div className="modal-body">
                    <div className="window-info">
                        <p><strong>Cycle:</strong> {window.cycleConfig?.name || 'Ad-hoc'}</p>
                        <p><strong>Scheduled:</strong> {new Date(window.scheduledStartDate).toLocaleString()}</p>
                        {window.assignedTo && (
                            <p><strong>Currently assigned to:</strong> {window.assignedTo.displayName || window.assignedTo.username}</p>
                        )}
                    </div>

                    <form onSubmit={handleAssign}>
                        <div className="form-group">
                            <label htmlFor="technician">
                                Select Technician <span className="required">*</span>
                            </label>
                            {isLoadingTechnicians ? (
                                <p className="loading-text">Loading IT staff...</p>
                            ) : technicians.length === 0 ? (
                                <p className="error-text">No IT staff available</p>
                            ) : (
                                <select
                                    id="technician"
                                    value={selectedTechnicianId}
                                    onChange={(e) => setSelectedTechnicianId(e.target.value)}
                                    required
                                >
                                    <option value="">-- Select Technician --</option>
                                    {technicians.map((tech) => (
                                        <option key={tech.id} value={tech.id}>
                                            {tech.displayName || tech.username}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {error && <div className="error-message">{error}</div>}

                        <div className="modal-actions">
                            <button type="button" onClick={() => onClose(false)} className="btn-secondary">
                                Cancel
                            </button>
                            <button type="submit" className="btn-primary" disabled={assignMutation.isPending || !selectedTechnicianId}>
                                {assignMutation.isPending ? 'Assigning...' : 'Assign'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ManualAssignmentModal;
