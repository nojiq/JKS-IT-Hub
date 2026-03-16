import { randomUUID } from 'node:crypto';
import * as repo from "../credentials/repo.js";
import { isUserDisabled } from "../users/repo.js";
import { createAuditLog } from "../audit/repo.js";

/**
 * Error for disabled user blocking export
 */
export class DisabledUserError extends Error {
    constructor(userId) {
        super('Cannot export credentials for disabled users');
        this.name = 'DisabledUserError';
        this.code = 'DISABLED_USER';
        this.userId = userId;
    }
}

import { formatSingleUserExport, formatBatchExport } from './formatter.js';
import { DEFAULT_FORMAT } from './config.js';

const getSystemId = (credential) =>
    credential.systemConfig?.systemId || credential.systemId || credential.system;

/**
 * Format credential export for single user
 * @param {Object} user - User object with id, username, email, displayName
 * @param {Array} credentials - Array of credential objects with username, password, systemConfig
 * @returns {string} - Formatted export text
 */
export function createExportService({
    credentialsRepo = repo,
    isUserDisabledFn = isUserDisabled,
    createAuditLogFn = createAuditLog,
    now = () => new Date(),
    nowMs = () => Date.now(),
    uuidFn = randomUUID
} = {}) {
    const formatCredentialExport = (user, credentials, format = DEFAULT_FORMAT) =>
        formatSingleUserExport(user, credentials, format);

    /**
     * Export credentials for a single user.
     *
     * MEMORY SAFETY NOTE:
     * This function processes exports entirely in-memory using string concatenation.
     * No temporary files are created on disk (fs.writeFileSync is strictly forbidden).
     * The final string is returned to be streamed directly to the client.
     *
     * @param {string} userId - ID of the user to export credentials for
     * @param {string} actorUserId - ID of the user performing the export
     * @returns {Promise<string>} - Formatted credential export text
     */
    const exportUserCredentials = async (userId, actorUserId, format = DEFAULT_FORMAT) => {
        const startTime = nowMs();

        const user = await credentialsRepo.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        if (isUserDisabledFn(user)) {
            throw new DisabledUserError(userId);
        }

        const credentials = await credentialsRepo.getUserCredentials(userId, false);

        const exportContent = formatCredentialExport(user, credentials, format);

        await createAuditLogFn({
            action: 'credentials.export.single_user',
            actorUserId,
            entityType: 'user',
            entityId: userId,
            metadata: {
                status: 'success',
                exportedSystems: credentials.map(getSystemId).filter(Boolean),
                credentialCount: credentials.length,
                exportTimestamp: now().toISOString(),
                format
            }
        });

        const duration = nowMs() - startTime;
        if (duration > 5000) {
            console.warn(`[Export Service] Export took ${duration}ms for user ${userId} (exceeds 5 second SLA)`);
        }

        return exportContent;
    };

    /**
     * Format batch credential export
     * @param {string} batchId - Batch ID
     * @param {Array} exportResults - Array of user export results
     * @param {Array} skippedUsers - Array of skipped users
     * @returns {string} - Formatted export text
     */
    const formatBatchCredentialExport = (batchId, exportResults, skippedUsers, format = DEFAULT_FORMAT) =>
        formatBatchExport(batchId, exportResults, skippedUsers, format);

    /**
     * Export credentials for multiple users
     * @param {Array<string>} userIds - Array of user IDs
     * @param {string} actorUserId - ID of the user performing the export
     * @returns {Promise<string>} - Formatted batch export text
     */
    const exportBatchCredentials = async (userIds, actorUserId, format = DEFAULT_FORMAT) => {
        const startTime = nowMs();
        const batchId = `batch-${uuidFn().slice(0, 8)}-${now().toISOString().split('T')[0].replace(/-/g, '')}`;
        const exportResults = [];
        const skippedUsers = [];

        // Fetch users in parallel
        const users = await Promise.all(userIds.map(id => credentialsRepo.getUserById(id)));

        // Process each user in parallel, then merge in original input order
        const processResults = await Promise.all(users.map(async (user, index) => {
            const userId = userIds[index];
            try {
                if (!user) {
                    return {
                        type: 'skip',
                        value: {
                            userId,
                            reason: 'User not found'
                        }
                    };
                }

                if (isUserDisabledFn(user)) {
                    return {
                        type: 'skip',
                        value: {
                            userId: user.id,
                            userName: user.displayName || user.email || user.username || user.ldapUsername,
                            reason: 'User is disabled'
                        }
                    };
                }

                const credentials = await credentialsRepo.getUserCredentials(user.id, false);

                if (credentials.length === 0) {
                    return {
                        type: 'skip',
                        value: {
                            userId: user.id,
                            userName: user.displayName || user.email || user.username || user.ldapUsername,
                            reason: 'No exportable credentials'
                        }
                    };
                }

                return {
                    type: 'export',
                    value: {
                        user,
                        credentials
                    }
                };
            } catch (error) {
                console.error(`[Batch Export] Failed to process user ${userId}:`, error);
                return {
                    type: 'skip',
                    value: {
                        userId: user?.id || userId,
                        userName: user?.displayName || user?.email || user?.username || user?.ldapUsername,
                        reason: 'Error retrieving credentials'
                    }
                };
            }
        }));

        for (const result of processResults) {
            if (result.type === 'export') {
                exportResults.push(result.value);
            } else {
                skippedUsers.push(result.value);
            }
        }

        const exportContent = formatBatchCredentialExport(batchId, exportResults, skippedUsers, format);
        const durationMs = nowMs() - startTime;

        // Audit log
        await createAuditLogFn({
            action: 'credentials.export.batch',
            actorUserId,
            entityType: 'batch',
            entityId: batchId,
            metadata: {
                status: skippedUsers.length > 0 ? 'partial_success' : 'success',
                totalUsers: userIds.length,
                successfulExports: exportResults.length,
                failedExports: skippedUsers.length,
                skippedUsers: skippedUsers.map(s => ({
                    userId: s.userId,
                    reason: s.reason
                })),
                exportedSystems: Object.fromEntries(
                    exportResults.map(r => [
                        r.user.id,
                        r.credentials.map(getSystemId)
                    ])
                ),
                exportTimestamp: now().toISOString(),
                durationMs,
                format
            }
        });

        if (durationMs > 30000) {
            console.warn(`[Batch Export] Export took ${durationMs}ms for ${userIds.length} users (exceeds 30 second SLA)`);
        } else {
            console.info(`[Batch Export] Completed in ${durationMs}ms for ${userIds.length} requested users`);
        }

        return exportContent;
    };

    return {
        formatCredentialExport,
        formatBatchCredentialExport,
        exportUserCredentials,
        exportBatchCredentials
    };
}

/**
 * Format batch credential export
 * @param {string} batchId - Batch ID
 * @param {Array} exportResults - Array of user export results
 * @param {Array} skippedUsers - Array of skipped users
 * @returns {string} - Formatted export text
 */
const defaultExportService = createExportService();

export const {
    formatCredentialExport,
    formatBatchCredentialExport,
    exportUserCredentials,
    exportBatchCredentials
} = defaultExportService;
