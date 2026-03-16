
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications, useMarkAllAsRead } from '../hooks/useNotifications.js';
import { NotificationItem } from './NotificationItem.jsx';
import './NotificationList.css';

export const NotificationList = ({ compact = false, onCloseDropdown }) => {
    // If compact, fetch fewer items
    const { data, isLoading, error } = useNotifications({
        page: 1,
        limit: compact ? 5 : 20
    });
    const { mutate: markAllAsRead } = useMarkAllAsRead();

    const handleMarkAll = (e) => {
        e.stopPropagation();
        markAllAsRead();
    };

    if (isLoading) return <div className="notification-loading">Loading...</div>;
    if (error) return <div className="notification-error">Failed to load notifications</div>;

    const notifications = data?.data || [];
    const total = data?.meta?.total || 0;
    const totalPages = data?.meta?.totalPages || 0;

    if (notifications.length === 0) {
        return <div className="notification-empty">No notifications</div>;
    }

    return (
        <div className={`notification-list ${compact ? 'compact' : ''}`}>
            <div className="notification-actions">
                <button
                    onClick={handleMarkAll}
                    className="mark-all-btn"
                    title="Mark all notifications as read"
                >
                    Mark all as read
                </button>
            </div>

            <div className="notification-items">
                {notifications.map(notif => (
                    <NotificationItem
                        key={notif.id}
                        notification={notif}
                        onCloseDropdown={onCloseDropdown}
                    />
                ))}
            </div>

            {/* If compact, show 'View all' link. If full, show load more/pagination (stubbed for now) */}
            {compact && total > 5 && (
                <div className="view-all">
                    <Link to="/notifications" className="view-all-link" onClick={onCloseDropdown}>View all notifications</Link>
                </div>
            )}

            {!compact && totalPages > 1 && (
                <div className="pagination">
                    {/* Implement full pagination here, maybe pass page prop to NotificationList instead of hardcoding 1 */}
                    {/* For MVP just a message or simpler pagination */}
                    <div style={{ textAlign: 'center', padding: '10px', color: '#888', fontSize: '0.8rem' }}>
                        Showing recent {notifications.length} of {total} notifications
                    </div>
                </div>
            )}
        </div>
    );
};
