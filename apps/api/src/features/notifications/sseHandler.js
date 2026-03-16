import { log } from '../../shared/logging/logger.js';
import { randomUUID } from 'crypto';

// Map of userId -> Set of response objects (for multiple tabs/devices)
const userConnections = new Map();

// Map of role -> Set of userIds for broadcasting
const roleUsers = new Map();

import { requireAuthenticated } from "../../shared/auth/requireAuthenticated.js";

const normalizeCorsOrigins = (originValue) => {
    if (originValue === undefined || originValue === null) return [];
    const normalized = String(originValue).trim();
    if (normalized === "*" || normalized.toLowerCase() === "true") {
        return true;
    }
    return normalized
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
};

const resolveAllowedOrigin = (origin, corsOriginConfig) => {
    if (!origin) return null;
    const allowedOrigins = normalizeCorsOrigins(corsOriginConfig);
    if (allowedOrigins === true) return origin;
    return allowedOrigins.includes(origin) ? origin : null;
};

/**
 * Register SSE route for live updates
 */
export const registerSSERoute = (fastify, { config, userRepo }) => {
    fastify.get('/api/v1/sse/stream', async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        const userId = actor.id;
        const userRole = actor.role;
        const origin = request.headers.origin;
        const allowedOrigin = resolveAllowedOrigin(origin, config?.cors?.origin);

        // Set SSE headers
        const headers = {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no' // Disable nginx buffering
        };

        // Raw SSE writes bypass Fastify's normal response lifecycle, so set CORS explicitly.
        if (allowedOrigin) {
            headers['Access-Control-Allow-Origin'] = allowedOrigin;
            headers['Access-Control-Allow-Credentials'] = 'true';
            headers.Vary = 'Origin';
        }

        reply.raw.writeHead(200, headers);

        // Track user connection
        if (!userConnections.has(userId)) {
            userConnections.set(userId, new Set());
        }
        userConnections.get(userId).add(reply.raw);

        // Track role membership
        if (!roleUsers.has(userRole)) {
            roleUsers.set(userRole, new Set());
        }
        roleUsers.get(userRole).add(userId);

        log.info({ userId, role: userRole }, 'SSE connection opened');

        // Send connection confirmation
        reply.raw.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', userId })}\n\n`);

        // Keep connection alive with heartbeats every 30 seconds
        const heartbeat = setInterval(() => {
            try {
                reply.raw.write(':heartbeat\n\n');
            } catch (err) {
                clearInterval(heartbeat);
            }
        }, 30000);

        // Cleanup on close
        request.raw.on('close', () => {
            clearInterval(heartbeat);
            const connections = userConnections.get(userId);
            if (connections) {
                connections.delete(reply.raw);
                if (connections.size === 0) {
                    userConnections.delete(userId);
                    // Remove from role tracking
                    const roleSet = roleUsers.get(userRole);
                    if (roleSet) {
                        roleSet.delete(userId);
                    }
                }
            }
            log.info({ userId }, 'SSE connection closed');
        });
    });
};

const pruneUserFromRoles = (userId) => {
    for (const usersWithRole of roleUsers.values()) {
        usersWithRole.delete(userId);
    }
};

/**
 * Emit an event to a specific user (all their connections)
 */
export const emitToUser = (userId, event) => {
    const connections = userConnections.get(userId);
    if (!connections || connections.size === 0) {
        return; // User not connected
    }

    const eventPayload = {
        id: randomUUID(),
        type: event.type,
        timestamp: new Date().toISOString(),
        data: event.data
    };

    const message = `event: ${event.type}\ndata: ${JSON.stringify(eventPayload)}\n\n`;

    for (const connection of [...connections]) {
        try {
            connection.write(message);
        } catch (error) {
            connections.delete(connection);
            log.error({ userId, error: error.message }, 'Failed to send SSE event');
        }
    }

    if (connections.size === 0) {
        userConnections.delete(userId);
        pruneUserFromRoles(userId);
    }
};

/**
 * Emit an event to all users with a specific role
 */
export const emitToRole = (role, event) => {
    const usersWithRole = roleUsers.get(role);
    if (!usersWithRole) return;

    for (const userId of usersWithRole) {
        emitToUser(userId, event);
    }
};

/**
 * Return connected user IDs for one or more roles
 */
export const getConnectedUserIdsByRoles = (roles) => {
    const resolvedRoles = Array.isArray(roles) ? roles : [roles];
    const userIds = new Set();
    for (const role of resolvedRoles) {
        const usersWithRole = roleUsers.get(role);
        if (!usersWithRole) continue;
        for (const userId of usersWithRole) {
            userIds.add(userId);
        }
    }
    return [...userIds];
};

/**
 * Emit an event to multiple specific users
 */
export const emitToUsers = (userIds, event) => {
    for (const userId of userIds) {
        emitToUser(userId, event);
    }
};

/**
 * Emit an event to all IT/Admin staff
 */
export const emitToITStaff = (event) => {
    emitToRole('it', event);
    emitToRole('admin', event);
    emitToRole('head_it', event);
};

/**
 * Emit an event to ALL connected users
 */
export const emitToAll = (event) => {
    for (const userId of userConnections.keys()) {
        emitToUser(userId, event);
    }
};

/**
 * Get count of active SSE connections (for monitoring)
 */
export const getConnectionStats = () => {
    let totalConnections = 0;
    for (const connections of userConnections.values()) {
        totalConnections += connections.size;
    }
    return {
        uniqueUsers: userConnections.size,
        totalConnections
    };
};

/**
 * Export for compatibility with existing code if needed
 */
// Backward compatibility adapter
export const sendToUser = (userId, notification, eventType = 'notification') => {
    emitToUser(userId, {
        type: eventType,
        data: notification
    });
};

export const addClient = (userId, rawRes) => {
    // Legacy support wrapper - not fully compatible but placeholder
    console.warn('Deprecated addClient called');
};

export const emitNotificationEvent = (userId, data, eventType = 'notification') => {
    return sendToUser(userId, data, eventType);
};

export const __test = {
    reset() {
        userConnections.clear();
        roleUsers.clear();
    },
    addConnection(userId, role, connection) {
        if (!userConnections.has(userId)) {
            userConnections.set(userId, new Set());
        }
        userConnections.get(userId).add(connection);

        if (role) {
            if (!roleUsers.has(role)) {
                roleUsers.set(role, new Set());
            }
            roleUsers.get(role).add(userId);
        }
    }
};
