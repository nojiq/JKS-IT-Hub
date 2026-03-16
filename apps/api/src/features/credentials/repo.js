import { prisma } from "../../shared/db/prisma.js";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENCRYPTED_SECRET_PREFIX = "enc:v1";
const ENCRYPTED_SECRET_PATTERN = /^enc:v1:([^:]+):([^:]+):(.+)$/;
let cachedEncryptionKey = null;

const getEncryptionKey = () => {
    if (cachedEncryptionKey) {
        return cachedEncryptionKey;
    }

    const source =
        process.env.CREDENTIAL_ENCRYPTION_KEY ||
        process.env.JWT_SECRET ||
        process.env.AUTH_JWT_SECRET;

    if (!source) {
        throw new Error(
            "Missing credential encryption key. Set CREDENTIAL_ENCRYPTION_KEY (preferred) or JWT_SECRET."
        );
    }

    cachedEncryptionKey = createHash("sha256").update(source).digest();
    return cachedEncryptionKey;
};

const isEncryptedSecret = (value) => {
    return typeof value === "string" && value.startsWith(`${ENCRYPTED_SECRET_PREFIX}:`);
};

const encryptSecret = (value) => {
    if (value === null || value === undefined) {
        return value;
    }

    if (isEncryptedSecret(value)) {
        return value;
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${ENCRYPTED_SECRET_PREFIX}:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
};

const decryptSecret = (value) => {
    if (typeof value !== "string" || !isEncryptedSecret(value)) {
        return value;
    }

    const parts = value.match(ENCRYPTED_SECRET_PATTERN);
    if (!parts) {
        return value;
    }

    const [, ivBase64, tagBase64, ciphertextBase64] = parts;
    const decipher = createDecipheriv(
        "aes-256-gcm",
        getEncryptionKey(),
        Buffer.from(ivBase64, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagBase64, "base64url"));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(ciphertextBase64, "base64url")),
        decipher.final()
    ]);

    return decrypted.toString("utf8");
};

const decryptPasswordFields = (value) => {
    if (Array.isArray(value)) {
        return value.map(decryptPasswordFields);
    }

    if (!value || typeof value !== "object") {
        return value;
    }

    if (value instanceof Date || value instanceof Uint8Array || Buffer.isBuffer(value)) {
        return value;
    }

    const result = {};
    for (const [key, val] of Object.entries(value)) {
        if (key === "password" && typeof val === "string") {
            result[key] = decryptSecret(val);
        } else {
            result[key] = decryptPasswordFields(val);
        }
    }

    return result;
};

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
    return tx.userCredential.create({
        data: {
            ...data,
            password: encryptSecret(data.password)
        }
    });
};

export const updateUserCredential = async (id, data, tx = prisma) => {
    const nextData = { ...data };
    if (Object.hasOwn(nextData, "password")) {
        nextData.password = encryptSecret(nextData.password);
    }

    return tx.userCredential.update({ where: { id }, data: nextData });
};

export const getUserCredentials = async (userId, includeItOnly = false, tx = prisma) => {
    const credentials = await tx.userCredential.findMany({
        where: {
            userId,
            isActive: true,
            ...(!includeItOnly && {
                systemConfig: { isItOnly: false }
            })
        },
        include: { systemConfig: true },
        orderBy: { systemId: 'asc' }
    });

    return decryptPasswordFields(credentials);
};

export const getUserCredentialById = async (id, tx = prisma) => {
    const credential = await tx.userCredential.findUnique({
        where: { id },
        include: { systemConfig: true }
    });

    return decryptPasswordFields(credential);
};

export const getUserCredentialBySystem = async (userId, system, tx = prisma) => {
    const credential = await tx.userCredential.findFirst({
        where: { userId, systemId: system, isActive: true }
    });

    return decryptPasswordFields(credential);
};

export const getActiveCredentialsForUser = async (userId, tx = prisma) => {
    const credentials = await tx.userCredential.findMany({
        where: { userId, isActive: true },
        include: { versions: true },
        orderBy: { systemId: 'asc' }
    });

    return decryptPasswordFields(credentials);
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
    return tx.credentialVersion.create({
        data: {
            ...data,
            password: encryptSecret(data.password)
        }
    });
};

// History Repository Functions

export const getCredentialHistoryByUser = async (userId, filters = {}, tx = prisma) => {
    const { system, startDate, endDate, page = 1, limit = 20 } = filters;

    const where = {
        credential: { userId }
    };

    if (system) {
        where.credential.systemId = system;
    }

    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
            where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
            where.createdAt.lte = new Date(endDate);
        }
    }

    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
        tx.credentialVersion.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            select: {
                id: true,
                username: true,
                reason: true,
                createdAt: true,
                createdByUser: {
                    select: { id: true, username: true }
                },
                credential: {
                    select: {
                        id: true,
                        userId: true,
                        systemId: true,
                        templateVersion: true,
                        isActive: true
                    }
                }
            }
        }),
        tx.credentialVersion.count({ where })
    ]);

    return {
        data: history,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

export const getCredentialVersionById = async (versionId, tx = prisma) => {
    const version = await tx.credentialVersion.findUnique({
        where: { id: versionId },
        include: {
            createdByUser: {
                select: { id: true, username: true }
            },
            credential: {
                select: {
                    id: true,
                    userId: true,
                    systemId: true,
                    templateVersion: true,
                    isActive: true
                }
            }
        }
    });

    return decryptPasswordFields(version);
};

export const getCredentialVersionsForComparison = async (versionIds, tx = prisma) => {
    const versions = await tx.credentialVersion.findMany({
        where: {
            id: { in: versionIds }
        },
        include: {
            createdByUser: {
                select: { id: true, username: true }
            },
            credential: {
                select: {
                    id: true,
                    userId: true,
                    systemId: true,
                    templateVersion: true,
                    isActive: true
                }
            }
        }
    });

    return decryptPasswordFields(versions);
};

export const getCredentialVersions = async (credentialId, tx = prisma) => {
    const versions = await tx.credentialVersion.findMany({
        where: { credentialId },
        orderBy: { createdAt: 'desc' }
    });

    return decryptPasswordFields(versions);
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

// Locked Credential Repository Functions

export const upsertLockRecord = async (data, tx = prisma) => {
    return tx.lockedCredential.upsert({
        where: {
            unique_user_system_lock: {
                userId: data.userId,
                systemId: data.systemId
            }
        },
        update: {
            isLocked: data.isLocked,
            lockedBy: data.lockedBy,
            lockedAt: data.lockedAt,
            lockReason: data.lockReason,
            unlockedBy: data.unlockedBy,
            unlockedAt: data.unlockedAt
        },
        create: {
            userId: data.userId,
            systemId: data.systemId,
            isLocked: data.isLocked,
            lockedBy: data.lockedBy,
            lockedAt: data.lockedAt,
            lockReason: data.lockReason,
            unlockedBy: data.unlockedBy,
            unlockedAt: data.unlockedAt
        }
    });
};

export const getLockRecord = async (userId, systemId, tx = prisma) => {
    return tx.lockedCredential.findUnique({
        where: {
            unique_user_system_lock: {
                userId,
                systemId
            }
        }
    });
};

export const updateLockRecord = async (userId, systemId, data, tx = prisma) => {
    return tx.lockedCredential.update({
        where: {
            unique_user_system_lock: { userId, systemId }
        },
        data
    });
};

export const getLockedCredentials = async (filters = {}, tx = prisma) => {
    const { userId, systemId, startDate, endDate, page = 1, limit = 20 } = filters;
    const where = { isLocked: true };

    if (userId) where.userId = userId;
    if (systemId) where.systemId = systemId;
    if (startDate || endDate) {
        where.lockedAt = {};
        if (startDate) {
            where.lockedAt.gte = new Date(startDate);
        }
        if (endDate) {
            where.lockedAt.lte = new Date(endDate);
        }
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
        tx.lockedCredential.findMany({
            where,
            include: {
                user: { select: { id: true, username: true, status: true, ldapAttributes: true } },
                system: { select: { systemId: true, description: true } }
            },
            orderBy: { lockedAt: 'desc' },
            skip,
            take: limit
        }),
        tx.lockedCredential.count({ where })
    ]);

    return {
        data,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};
