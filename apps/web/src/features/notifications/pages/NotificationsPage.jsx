
import React from 'react';
import { NotificationList } from '../components/NotificationList.jsx';
import './NotificationsPage.css';

const NotificationsPage = () => {
    return (
        <div className="notifications-page">
            <header className="page-header">
                <h1 className="page-title">Notifications</h1>
            </header>
            <div className="notifications-content">
                <NotificationList compact={false} />
            </div>
        </div>
    );
};

export default NotificationsPage;
