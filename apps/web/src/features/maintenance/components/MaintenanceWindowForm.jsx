import React, { useState, useEffect } from 'react';
import { useUpdateWindow, useCreateWindow, useCycles } from "../hooks/useMaintenance.js";
import DeviceTypeSelector from "./DeviceTypeSelector.jsx";
import './MaintenanceWindowForm.css';

const MaintenanceWindowForm = ({ window: initialWindow, onClose }) => {
    const isEdit = !!initialWindow;

    // Normalize existing deviceTypes to array of strings
    const initialDeviceTypes = initialWindow?.deviceTypes
        ? initialWindow.deviceTypes.map(d => typeof d === 'string' ? d : d.deviceType)
        : [];

    const [formData, setFormData] = useState({
        cycleConfigId: '',
        scheduledStartDate: '',
        scheduledEndDate: '',
        deviceTypes: []
    });

    const [statusMessage, setStatusMessage] = useState(null);

    useEffect(() => {
        if (initialWindow) {
            // Format dates for input type="datetime-local" (YYYY-MM-DDTHH:mm)
            const formatDate = (dateStr) => {
                if (!dateStr) return '';
                const d = new Date(dateStr);
                return d.toISOString().slice(0, 16);
            };

            setFormData({
                cycleConfigId: initialWindow.cycleConfigId || '',
                scheduledStartDate: formatDate(initialWindow.scheduledStartDate),
                scheduledEndDate: formatDate(initialWindow.scheduledEndDate),
                deviceTypes: initialDeviceTypes
            });
        }
    }, [initialWindow]);

    const updateWindow = useUpdateWindow();
    const createWindow = useCreateWindow();
    const { data: cycles = [] } = useCycles(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatusMessage(null);

        if (formData.deviceTypes.length === 0) {
            setStatusMessage({ type: 'error', text: 'Please select at least one device type coverage.' });
            return;
        }

        try {
            const payload = {
                cycleConfigId: formData.cycleConfigId,
                scheduledStartDate: new Date(formData.scheduledStartDate).toISOString(),
                deviceTypes: formData.deviceTypes
            };
            if (formData.scheduledEndDate) {
                payload.scheduledEndDate = new Date(formData.scheduledEndDate).toISOString();
            }

            if (isEdit) {
                await updateWindow.mutateAsync({ id: initialWindow.id, data: payload });
            } else {
                await createWindow.mutateAsync(payload);
            }
            onClose(true);
        } catch (error) {
            setStatusMessage({ type: 'error', text: error.message || 'Failed to update maintenance window.' });
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleDeviceTypeChange = (newTypes) => {
        setFormData(prev => ({ ...prev, deviceTypes: newTypes }));
    };

    return (
        <div className="maintenance-window-form-overlay">
            <div className="maintenance-window-form-modal">
                <div className="form-header">
                    <h2>{isEdit ? 'Edit Maintenance Window' : 'Create Maintenance Window'}</h2>
                    <button onClick={() => onClose(false)} className="close-btn">&times;</button>
                </div>

                {statusMessage && (
                    <div className={`status-message ${statusMessage.type}`}>
                        {statusMessage.text}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {!isEdit && (
                        <div className="form-group">
                            <label>Cycle</label>
                            <select
                                name="cycleConfigId"
                                value={formData.cycleConfigId}
                                onChange={handleChange}
                                className="form-control"
                                required
                            >
                                <option value="">Select a cycle</option>
                                {cycles.map((cycle) => (
                                    <option key={cycle.id} value={cycle.id}>
                                        {cycle.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Start Date & Time</label>
                        <input
                            type="datetime-local"
                            name="scheduledStartDate"
                            value={formData.scheduledStartDate}
                            onChange={handleChange}
                            className="form-control"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>End Date & Time</label>
                        <input
                            type="datetime-local"
                            name="scheduledEndDate"
                            value={formData.scheduledEndDate}
                            onChange={handleChange}
                            className="form-control"
                        />
                    </div>

                    <DeviceTypeSelector
                        value={formData.deviceTypes}
                        onChange={handleDeviceTypeChange}
                        required
                    />

                    <div className="form-actions">
                        <button type="button" onClick={() => onClose(false)} className="btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={updateWindow.isPending || createWindow.isPending}>
                            {updateWindow.isPending || createWindow.isPending
                                ? 'Saving...'
                                : isEdit
                                    ? 'Save Changes'
                                    : 'Create Window'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MaintenanceWindowForm;
