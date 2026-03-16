
import React, { useState, useRef, useEffect } from 'react';
import { useUnreadCount } from '../hooks/useNotifications.js';
import { useNotificationSSE } from '../hooks/useNotificationSSE.js';
import { NotificationList } from './NotificationList.jsx';
import './NotificationBell.css';

export const NotificationBell = () => {
    // Enable SSE for real-time updates while this component is mounted
    useNotificationSSE();

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const { data: countData } = useUnreadCount();

    // API returns { data: { count: number } }
    const count = countData?.data?.count || 0;

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            // Use mousedown to detect outside clicks earlier than click
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="notification-bell-container" ref={dropdownRef}>
            <button
                className="notification-bell-btn"
                onClick={toggleDropdown}
                aria-label="Notifications"
                title="Notifications"
            >
                {/* Bell Icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>

                {count > 0 && (
                    <span className="notification-badge">
                        {count > 99 ? '99+' : count}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="notification-dropdown">
                    <NotificationList compact={true} onCloseDropdown={() => setIsOpen(false)} />
                </div>
            )}
        </div>
    );
};
