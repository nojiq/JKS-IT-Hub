import React, { createContext, useState, useCallback } from 'react';
import Toast from './Toast.jsx';

export const ToastContext = createContext(null);

/**
 * Provider component that manages toast notifications
 */
export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((title, message, variant = 'info', duration = 5000) => {
        const id = Date.now() + Math.random();
        const newToast = { id, title, message, variant, duration };

        setToasts(prev => [...prev, newToast]);

        return id;
    }, []);

    const hideToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const value = {
        showToast,
        hideToast,
        success: (title, message, duration) => showToast(title, message, 'success', duration),
        error: (title, message, duration) => showToast(title, message, 'error', duration),
        warning: (title, message, duration) => showToast(title, message, 'warning', duration),
        info: (title, message, duration) => showToast(title, message, 'info', duration)
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="toast-container">
                {toasts.map(toast => (
                    <Toast
                        key={toast.id}
                        {...toast}
                        onClose={hideToast}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
};
