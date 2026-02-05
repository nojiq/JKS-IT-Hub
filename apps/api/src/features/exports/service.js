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

/**
 * Format credential export for single user
 * @param {Object} user - User object with id, username, email, displayName
 * @param {Array} credentials - Array of credential objects with username, password, systemConfig
 * @returns {string} - Formatted export text
 */
export function formatCredentialExport(user, credentials) {
    const timestamp = new Date().toISOString();
    const displayName = user.displayName || user.email || user.username || user.ldapUsername || 'Unknown';
    const lines = [
        'IT-HUB CREDENTIAL EXPORT',
        `Generated: ${timestamp}`,
        `User: ${displayName}`,
        `Systems: ${credentials.length}`,
        '',
        ...credentials.flatMap(cred => {
            const systemName = cred.systemConfig?.description || cred.systemConfig?.systemId || cred.systemId || cred.system || 'Unknown';
            return [
                '---------------------------------',
                systemName,
                `Username: ${cred.username}`,
                `Password: ${cred.password}`,
                '---------------------------------',
                ''
            ];
        }),
        'End of export'
    ];

    return lines.join('\n');
}

/**
 * Export credentials for a single user
 * @param {string} userId - ID of the user to export credentials for
 * @param {string} actorUserId - ID of the user performing the export
 * @returns {Promise<string>} - Formatted credential export text
 */
export async function exportUserCredentials(userId, actorUserId) {
    const startTime = Date.now();

    const user = await repo.getUserById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    if (isUserDisabled(user)) {
        throw new DisabledUserError(userId);
    }

    const credentials = await repo.getUserCredentials(userId, false);

    const exportContent = formatCredentialExport(user, credentials);

    await createAuditLog({
        action: 'credentials.export.single_user',
        actorUserId,
        entityType: 'user',
        entityId: userId,
        metadata: {
            exportedSystems: credentials.map(c => c.systemConfig?.systemId || c.systemId || c.system).filter(Boolean),
            credentialCount: credentials.length,
            exportTimestamp: new Date().toISOString()
        }
    });

    const duration = Date.now() - startTime;
    if (duration > 5000) {
        console.warn(`[Export Service] Export took ${duration}ms for user ${userId} (exceeds 5 second SLA)`);
    }

    return exportContent;
}
