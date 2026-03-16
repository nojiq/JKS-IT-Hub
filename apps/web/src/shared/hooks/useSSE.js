
import { useEffect } from 'react';
import { updateSSEConnectionStatus } from '../components/ConnectionStatus.jsx';
import { buildApiUrl } from '../utils/api-client.js';

const RECONNECT_BASE_DELAY_MS = 5000;
const RECONNECT_MAX_DELAY_MS = 60000;

const sseManager = {
    source: null,
    listeners: new Map(), // type -> Set<callback>
    typeHandlers: new Map(), // type -> handler function
    reconnectTimer: null,
    isConnecting: false,
    reconnectAttempts: 0,

    connect() {
        if (this.source && (this.source.readyState === EventSource.OPEN || this.source.readyState === EventSource.CONNECTING)) {
            return;
        }

        if (this.isConnecting) return;
        this.isConnecting = true;

        console.log('[SSE] Connecting...');
        updateSSEConnectionStatus('connecting');
        // Must target the API server (VITE_API_BASE_URL) in dev; same-origin in prod (baseUrl="") works too.
        this.source = new EventSource(buildApiUrl('/api/v1/sse/stream'), { withCredentials: true });

        this.source.onopen = () => {
            console.log('[SSE] Connected');
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            updateSSEConnectionStatus('connected');
            // Re-attach handlers to new source instance
            this.typeHandlers.forEach((handler, type) => {
                this.source.addEventListener(type, handler);
            });
        };

        this.source.onerror = (err) => {
            console.error('[SSE] Connection Error', err);
            this.source.close();
            this.source = null;
            this.isConnecting = false;
            updateSSEConnectionStatus('disconnected');
            this.scheduleReconnect();
        };

        // Attach existing handlers directly if we just created source (but before open? yes standard allows)
        this.typeHandlers.forEach((handler, type) => {
            this.source.addEventListener(type, handler);
        });
    },

    scheduleReconnect() {
        if (this.reconnectTimer) return;
        const delay = Math.min(
            RECONNECT_BASE_DELAY_MS * (2 ** this.reconnectAttempts),
            RECONNECT_MAX_DELAY_MS
        );
        this.reconnectAttempts += 1;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    },

    createHandler(type) {
        return (event) => {
            let data = event.data;
            try {
                data = JSON.parse(event.data);
            } catch (e) {
                // Keep raw data if parse fails
            }

            const callbacks = this.listeners.get(type);
            if (callbacks) {
                callbacks.forEach(cb => {
                    try {
                        cb(data);
                    } catch (err) {
                        console.error(`[SSE] Error in callback for ${type}`, err);
                    }
                });
            }
        };
    },

    subscribe(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());

            // Create and store handler
            if (!this.typeHandlers.has(type)) {
                const handler = this.createHandler(type);
                this.typeHandlers.set(type, handler);

                // Attach to current source if exists
                if (this.source) {
                    this.source.addEventListener(type, handler);
                }
            }
        }

        this.listeners.get(type).add(callback);

        if (!this.source) {
            this.connect();
        }
    },

    unsubscribe(type, callback) {
        const callbacks = this.listeners.get(type);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this.listeners.delete(type);
                const handler = this.typeHandlers.get(type);
                if (handler && this.source) {
                    this.source.removeEventListener(type, handler);
                }
                this.typeHandlers.delete(type);
            }
        }

        if (this.listeners.size === 0) {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            if (this.source) {
                this.source.close();
                this.source = null;
            }
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            updateSSEConnectionStatus('disconnected');
        }
    }
};

export const subscribeToSSE = (eventType, callback) => {
    sseManager.subscribe(eventType, callback);
};

export const unsubscribeFromSSE = (eventType, callback) => {
    sseManager.unsubscribe(eventType, callback);
};

/**
 * Hook to subscribe to Server-Sent Events
 * @param {string} eventType - The event name to listen for (e.g. 'request.created')
 * @param {Function} callback - Function to call with event data
 */
export const useSSE = (eventType, callback) => {
    useEffect(() => {
        if (!eventType || !callback) return;

        subscribeToSSE(eventType, callback);

        return () => {
            unsubscribeFromSSE(eventType, callback);
        };
    }, [eventType, callback]);
};
