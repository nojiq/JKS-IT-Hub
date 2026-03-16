import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarkAsRead } from '../hooks/useNotifications.js';
import './NotificationItem.css';

const formatTime = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.max(0, now - date); // avoid negative
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) return date.toLocaleDateString(); // e.g., "12/10/2023"
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
};

export const NotificationItem = ({ notification, onCloseDropdown }) => {
    const navigate = useNavigate();
    const { mutate: markAsRead } = useMarkAsRead();
    const isMaintenanceOverdue = notification.type === 'maintenance_overdue';

    const handleClick = () => {
        if (!notification.isRead) {
            markAsRead(notification.id);
        }

        // Navigate based on referenceType
        if (notification.referenceType === 'item_request' && notification.referenceId) {
            navigate(`/requests/${notification.referenceId}`);
        }
        if (notification.referenceType === 'maintenance_window' && notification.referenceId) {
            navigate(`/maintenance/schedule/${notification.referenceId}`);
        }

        if (onCloseDropdown) onCloseDropdown();
    };

    return (
        <div
            className={`notification-item ${!notification.isRead ? 'unread' : 'read'} ${isMaintenanceOverdue ? 'high-priority' : ''}`}
            onClick={handleClick}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => { if (e.key === 'Enter') handleClick(); }}
        >
            <div className="notification-header">
                <span className="notification-title">{notification.title}</span>
                <span className="notification-time">{formatTime(notification.createdAt)}</span>
            </div>
            <div className="notification-message">{notification.message}</div>
            {!notification.isRead && <div className="unread-dot" aria-label="Unread"></div>}
        </div>
    );
};
