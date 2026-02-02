import { prisma } from "../../shared/db/prisma.js";

export const createCredentialTemplate = async (data, tx = prisma) => {
    return tx.credentialTemplate.create({ data });
};

export const updateCredentialTemplate = async (id, data, tx = prisma) => {
    return tx.credentialTemplate.update({ where: { id }, data });
};

export const getCredentialTemplates = async (tx = prisma) => {
    return tx.credentialTemplate.findMany({
        orderBy: { updatedAt: 'desc' }
    });
};

export const getCredentialTemplateById = async (id, tx = prisma) => {
    return tx.credentialTemplate.findUnique({ where: { id } });
};

export const deactivateAllTemplates = async (tx = prisma) => {
    // Used when setting a new active template
    // Use transaction if provided
    return tx.credentialTemplate.updateMany({
        where: { isActive: true },
        data: { isActive: false }
    });
};

export const getActiveCredentialTemplate = async (tx = prisma) => {
    return tx.credentialTemplate.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' }
    });
};

// User Credential Repository Functions

export const getUserById = async (id, tx = prisma) => {
    return tx.user.findUnique({ where: { id } });
};

export const createUserCredential = async (data, tx = prisma) => {
    return tx.userCredential.create({ data });
};

export const updateUserCredential = async (id, data, tx = prisma) => {
    return tx.userCredential.update({ where: { id }, data });
};

export const getUserCredentials = async (userId, tx = prisma) => {
    return tx.userCredential.findMany({
        where: { userId, isActive: true },
        include: { versions: true },
        orderBy: { system: 'asc' }
    });
};

export const getUserCredentialById = async (id, tx = prisma) => {
    return tx.userCredential.findUnique({
        where: { id },
        include: { versions: true }
    });
};

export const getUserCredentialBySystem = async (userId, system, tx = prisma) => {
    return tx.userCredential.findFirst({
        where: { userId, system, isActive: true }
    });
};

export const deactivateUserCredentials = async (userId, tx = prisma) => {
    return tx.userCredential.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false }
    });
};

export const deactivateUserCredential = async (id, tx = prisma) => {
    return tx.userCredential.update({
        where: { id },
        data: { isActive: false }
    });
};

// Credential Version Repository Functions

export const createCredentialVersion = async (data, tx = prisma) => {
    return tx.credentialVersion.create({ data });
};

export const getCredentialVersions = async (credentialId, tx = prisma) => {
    return tx.credentialVersion.findMany({
        where: { credentialId },
        orderBy: { createdAt: 'desc' }
    });
};

// Preview Session Storage (In-Memory with Expiration)
const previewSessions = new Map();

// Configuration from environment or defaults
const PREVIEW_EXPIRY_MS = parseInt(process.env.PREVIEW_SESSION_EXPIRY_MS, 10) || 5 * 60 * 1000; // 5 minutes default
const CLEANUP_INTERVAL_MS = parseInt(process.env.PREVIEW_CLEANUP_INTERVAL_MS, 10) || 60 * 1000; // 1 minute default

// Set up automatic cleanup interval to prevent memory leaks
let cleanupInterval = null;

const startCleanupInterval = () => {
    if (!cleanupInterval) {
        cleanupInterval = setInterval(() => {
            cleanupExpiredSessions();
        }, CLEANUP_INTERVAL_MS);
    }
};

// Start cleanup on first session store
const ensureCleanupRunning = () => {
    if (!cleanupInterval) {
        startCleanupInterval();
    }
};

export const storePreviewSession = async (token, sessionData) => {
    ensureCleanupRunning(); // Start cleanup interval if not already running
    const expiresAt = Date.now() + PREVIEW_EXPIRY_MS;
    previewSessions.set(token, {
        ...sessionData,
        expiresAt
    });
    return token;
};

export const getPreviewSession = async (token) => {
    const session = previewSessions.get(token);
    
    if (!session) {
        return null;
    }
    
    // Check if expired
    if (Date.now() > session.expiresAt) {
        previewSessions.delete(token);
        return null;
    }
    
    return session;
};

export const deletePreviewSession = async (token) => {
    previewSessions.delete(token);
    return true;
};

export const cleanupExpiredSessions = async () => {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [token, session] of previewSessions.entries()) {
        if (now > session.expiresAt) {
            previewSessions.delete(token);
            cleanedCount++;
        }
    }
    if (cleanedCount > 0) {
        console.log(`[Preview Sessions] Cleaned up ${cleanedCount} expired sessions`);
    }
};

// Graceful shutdown cleanup
export const stopCleanupInterval = () => {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
};

