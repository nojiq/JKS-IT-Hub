import React, { useState, useEffect, useCallback } from 'react';

const sseConnectionManager = {
    listeners: new Set(),
    currentStatus: 'disconnected', // 'connected' | 'disconnected' | 'connecting'

    setStatus(status) {
        this.currentStatus = status;
        this.listeners.forEach(listener => listener(status));
    },

    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.currentStatus); // Send current status immediately
        return () => {
            this.listeners.delete(listener);
        };
    }
};

// Export for use by SSE hook
export const updateSSEConnectionStatus = (status) => {
    sseConnectionManager.setStatus(status);
};

export const subscribeSSEConnectionStatus = (listener) => sseConnectionManager.subscribe(listener);

export const getSSEConnectionStatus = () => sseConnectionManager.currentStatus;

/**
 * Connection Status Indicator Component
 * Shows a subtle indicator of SSE connection status
 */
const ConnectionStatus = () => {
    const [status, setStatus] = useState('disconnected');
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const unsubscribe = sseConnectionManager.subscribe(setStatus);
        return unsubscribe;
    }, []);

    useEffect(() => {
        // Only show indicator when not connected
        if (status === 'disconnected' || status === 'connecting') {
            setIsVisible(true);
        } else {
            // Hide after a brief period when connected
            const timer = setTimeout(() => setIsVisible(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    if (!isVisible && status === 'connected') {
        return null;
    }

    const statusConfig = {
        connected: {
            color: '#10b981',
            text: 'Connected',
            icon: '●'
        },
        connecting: {
            color: '#f59e0b',
            text: 'Reconnecting...',
            icon: '◐'
        },
        disconnected: {
            color: '#ef4444',
            text: 'Disconnected',
            icon: '○'
        }
    };

    const config = statusConfig[status] || statusConfig.disconnected;

    return (
        <div className="connection-status" role="status" aria-live="polite">
            <span className="connection-icon" style={{ color: config.color }}>
                {config.icon}
            </span>
            <span className="connection-text">{config.text}</span>

            <style>{`
                .connection-status {
                    position: fixed;
                    bottom: 1rem;
                    right: 1rem;
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    padding: 0.5rem 0.75rem;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.875rem;
                    z-index: 9998;
                    animation: fadeIn 0.3s ease-in;
                }

                .connection-icon {
                    font-size: 1rem;
                    line-height: 1;
                }

                .connection-text {
                    color: #6b7280;
                    font-weight: 500;
                }

                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @media (max-width: 640px) {
                    .connection-status {
                        bottom: 0.5rem;
                        right: 0.5rem;
                        font-size: 0.8125rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default ConnectionStatus;
