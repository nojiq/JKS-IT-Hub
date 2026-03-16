import React, { useEffect } from 'react';
import './toast.css';

const VARIANTS = {
    success: {
        icon: '✓',
        color: '#10b981'
    },
    error: {
        icon: '✕',
        color: '#ef4444'
    },
    warning: {
        icon: '⚠',
        color: '#f59e0b'
    },
    info: {
        icon: 'ℹ',
        color: '#3b82f6'
    }
};

/**
 * Individual Toast notification component
 */
const Toast = ({ id, title, message, variant = 'info', duration = 5000, onClose }) => {
    const variantConfig = VARIANTS[variant] || VARIANTS.info;

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                onClose(id);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [id, duration, onClose]);

    return (
        <div
            className={`toast toast-${variant}`}
            role="alert"
            aria-live="polite"
        >
            <div className="toast-icon" style={{ color: variantConfig.color }}>
                {variantConfig.icon}
            </div>
            <div className="toast-content">
                {title && <div className="toast-title">{title}</div>}
                {message && <div className="toast-message">{message}</div>}
            </div>
            <button
                className="toast-close"
                onClick={() => onClose(id)}
                aria-label="Close notification"
            >
                ✕
            </button>
        </div>
    );
};

export default Toast;
