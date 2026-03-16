import React from 'react';
import './DeviceTypeBadge.css';

const DeviceTypeBadge = ({ deviceTypes, showCount = false }) => {
    if (!deviceTypes || deviceTypes.length === 0) return null;

    const normalizedTypes = deviceTypes
        .map((d) => (typeof d === 'string' ? d : d?.deviceType))
        .filter(Boolean);

    if (normalizedTypes.length === 0) return null;

    const priority = { 'LAPTOP': 1, 'DESKTOP_PC': 2, 'SERVER': 3 };
    const labels = {
        'LAPTOP': 'Laptop',
        'DESKTOP_PC': 'Desktop PC',
        'SERVER': 'Server'
    };
    const icons = {
        'LAPTOP': '💻',
        'DESKTOP_PC': '🖥️',
        'SERVER': '🖧'
    };
    const counts = normalizedTypes.reduce((acc, type) => {
        acc[type] = (acc[type] ?? 0) + 1;
        return acc;
    }, {});
    const types = Object.keys(counts).sort((a, b) => (priority[a] || 99) - (priority[b] || 99));

    return (
        <span className="device-type-badges">
            {types.map(type => (
                <span key={type} className={`device-badge badge-${type.toLowerCase()}`}>
                    <span className="device-badge-icon" aria-hidden="true">{icons[type] || '🧩'}</span>
                    <span>{labels[type] || type}{showCount ? ` (${counts[type]})` : ''}</span>
                </span>
            ))}
        </span>
    );
};

export default DeviceTypeBadge;
