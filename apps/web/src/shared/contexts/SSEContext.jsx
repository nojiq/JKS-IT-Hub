import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { subscribeToSSE, unsubscribeFromSSE } from '../hooks/useSSE.js';
import { getSSEConnectionStatus, subscribeSSEConnectionStatus } from '../components/ConnectionStatus.jsx';

const SSEContext = createContext(null);

export const SSEProvider = ({ children }) => {
    const [connectionStatus, setConnectionStatus] = useState(getSSEConnectionStatus());

    useEffect(() => subscribeSSEConnectionStatus(setConnectionStatus), []);

    const subscribe = useCallback((eventType, callback) => {
        if (!eventType || !callback) {
            return () => {};
        }
        subscribeToSSE(eventType, callback);
        return () => unsubscribeFromSSE(eventType, callback);
    }, []);

    const value = useMemo(() => ({
        connectionStatus,
        subscribe
    }), [connectionStatus, subscribe]);

    return (
        <SSEContext.Provider value={value}>
            {children}
        </SSEContext.Provider>
    );
};

export const useSSEContext = () => {
    const context = useContext(SSEContext);
    if (!context) {
        throw new Error('useSSEContext must be used within SSEProvider');
    }
    return context;
};
