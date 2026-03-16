import React from 'react';
import './DeviceTypeSelector.css';

const DEVICE_TYPES = [
    { value: 'LAPTOP', label: 'Laptop', icon: '💻' },
    { value: 'DESKTOP_PC', label: 'Desktop PC', icon: '🖥️' },
    { value: 'SERVER', label: 'Server', icon: '💾' }
];

const DeviceTypeSelector = ({ value = [], onChange, required = false }) => {

    const handleToggle = (typeValue) => {
        const currentIndex = value.indexOf(typeValue);
        const newSelected = [...value];

        if (currentIndex === -1) {
            newSelected.push(typeValue);
        } else {
            newSelected.splice(currentIndex, 1);
        }

        onChange(newSelected);
    };

    return (
        <div className="device-type-selector">
            <label className="selector-label">
                Device Coverage
                {required && <span className="required-asterisk">*</span>}
            </label>
            <div className="device-options">
                {DEVICE_TYPES.map((type) => (
                    <button
                        key={type.value}
                        type="button"
                        className={`device-option-btn ${value.includes(type.value) ? 'selected' : ''}`}
                        onClick={() => handleToggle(type.value)}
                        aria-pressed={value.includes(type.value)}
                    >
                        <span className="device-icon">{type.icon}</span>
                        <span className="device-label">{type.label}</span>
                        {value.includes(type.value) && <span className="check-mark">✓</span>}
                    </button>
                ))}
            </div>
            {required && value.length === 0 && (
                <div className="validation-error">At least one device type is required.</div>
            )}
        </div>
    );
};

export default DeviceTypeSelector;
