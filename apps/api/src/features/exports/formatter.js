import { FORMAT_TYPES, DEFAULT_FORMAT } from './config.js';
export { FORMAT_TYPES, DEFAULT_FORMAT };

const DELIMITERS = {
    ENTRY_SEPARATOR: '---------------------------------',
    SECTION_SEPARATOR: '=================================',
    FIELD_SEPARATOR: '|'
};

/**
 * Format a single credential entry for standard export
 * @param {Object} credential - Credential with systemConfig relation
 * @returns {string[]} Array of lines for this entry
 */
export function formatSystemEntry(credential) {
    const systemName = credential.systemConfig?.description || credential.systemConfig?.systemId || credential.systemId || credential.system || 'Unknown';
    return [
        DELIMITERS.ENTRY_SEPARATOR,
        systemName,
        `Username: ${credential.username}`,
        `Password: ${credential.password}`,
        DELIMITERS.ENTRY_SEPARATOR,
        ''
    ];
}

/**
 * Format export header for standard format
 * @param {string} type - 'single' or 'batch'
 * @param {Object} user - User object (for single exports)
 * @param {Object} metadata - Export metadata
 * @returns {string[]} Array of header lines
 */
export function formatExportHeader(type, user, metadata) {
    const timestamp = new Date().toISOString();

    if (type === 'single') {
        const userName = user?.displayName || user?.email || user?.username || user?.ldapUsername || 'Unknown';
        const userEmail = user?.email || '';
        return [
            'IT-HUB CREDENTIAL EXPORT',
            `Generated: ${timestamp}`,
            `User: ${userName}${userEmail ? ` (${userEmail})` : ''}`,
            `Systems: ${metadata.systemCount}`,
            ''
        ];
    } else {
        return [
            'IT-HUB BATCH CREDENTIAL EXPORT',
            `Generated: ${timestamp}`,
            `Batch ID: ${metadata.batchId}`,
            `Total Users: ${metadata.totalUsers}`,
            `Successful Exports: ${metadata.successfulExports}`,
            `Skipped Users: ${metadata.skippedUsers}`,
            ''
        ];
    }
}

/**
 * Format complete single-user export
 * @param {Object} user - User object
 * @param {Object[]} credentials - Array of credentials with systemConfig
 * @param {string} format - Format type ('standard' or 'compressed')
 * @returns {string} Formatted export content
 */
export function formatSingleUserExport(user, credentials, format = DEFAULT_FORMAT) {
    // Sort credentials alphabetically by systemId
    const sortedCredentials = [...credentials].sort((a, b) => {
        const idA = a.systemConfig?.systemId || a.systemId || a.system || '';
        const idB = b.systemConfig?.systemId || b.systemId || b.system || '';
        return idA.localeCompare(idB);
    });

    if (format === FORMAT_TYPES.COMPRESSED) {
        return formatCompressedSingleUser(user, sortedCredentials);
    }

    return formatStandardSingleUser(user, sortedCredentials);
}

/**
 * Format complete batch export
 * @param {string} batchId - Batch identifier
 * @param {Object[]} exportResults - Array of { user, credentials } objects
 * @param {Object[]} skippedUsers - Array of skipped user info
 * @param {string} format - Format type ('standard' or 'compressed')
 * @returns {string} Formatted export content
 */
export function formatBatchExport(batchId, exportResults, skippedUsers, format = DEFAULT_FORMAT) {
    if (format === FORMAT_TYPES.COMPRESSED) {
        return formatCompressedBatch(batchId, exportResults, skippedUsers);
    }

    return formatStandardBatch(batchId, exportResults, skippedUsers);
}

// Private helper functions for standard format
function formatStandardSingleUser(user, credentials) {
    const lines = [
        ...formatExportHeader('single', user, { systemCount: credentials.length }),
        ...credentials.flatMap(cred => formatSystemEntry(cred)),
        'End of export'
    ];
    return lines.join('\n');
}

function formatStandardBatch(batchId, exportResults, skippedUsers) {
    const totalUsers = exportResults.length + skippedUsers.length;
    const metadata = {
        batchId,
        totalUsers,
        successfulExports: exportResults.length,
        skippedUsers: skippedUsers.length
    };

    const lines = [
        ...formatExportHeader('batch', null, metadata)
    ];

    // Add each user's credentials
    exportResults.forEach((result, index) => {
        const { user, credentials } = result;
        const sortedCredentials = [...credentials].sort((a, b) => {
            const idA = a.systemConfig?.systemId || a.systemId || a.system || '';
            const idB = b.systemConfig?.systemId || b.systemId || b.system || '';
            return idA.localeCompare(idB);
        });

        const userName = user.displayName || user.email || user.username || user.ldapUsername || 'Unknown';
        lines.push(
            DELIMITERS.SECTION_SEPARATOR,
            `USER ${index + 1} OF ${totalUsers}`,
            DELIMITERS.SECTION_SEPARATOR,
            `User: ${userName}${user.email ? ` (${user.email})` : ''}`,
            `User ID: ${user.id}`,
            `Systems: ${sortedCredentials.length}`,
            '',
            ...sortedCredentials.flatMap(cred => formatSystemEntry(cred))
        );
    });

    // Add skipped users section
    if (skippedUsers.length > 0) {
        lines.push(
            DELIMITERS.SECTION_SEPARATOR,
            'SKIPPED USERS',
            DELIMITERS.SECTION_SEPARATOR,
            ...skippedUsers.flatMap(skipped => [
                `User: ${skipped.userName || skipped.username || 'Unknown'}${skipped.userEmail ? ` (${skipped.userEmail})` : ''}`,
                `User ID: ${skipped.userId}`,
                `Reason: ${skipped.reason}`,
                ''
            ])
        );
    }

    lines.push(
        DELIMITERS.SECTION_SEPARATOR,
        'End of batch export'
    );

    return lines.join('\n');
}

// Private helper functions for compressed format
function escapeField(value) {
    if (!value) return '';
    return value
        .toString()
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/\|/g, '\\|')   // Escape pipe
        .replace(/\n/g, '\\n')   // Escape newlines
        .replace(/\r/g, '\\r');  // Escape carriage returns
}

function formatCompressedSingleUser(user, credentials) {
    const timestamp = new Date().toISOString();
    const userName = user.displayName || user.email || user.username || user.ldapUsername || '';
    const userEmail = user.email || '';

    const lines = [
        `IT-HUB|EXPORT|SINGLE|${timestamp}|${escapeField(userName)}|${escapeField(userEmail)}`,
        ...credentials.map(cred =>
            `${escapeField(cred.systemConfig?.systemId || cred.systemId || cred.system)}|${escapeField(cred.username)}|${escapeField(cred.password)}`
        )
    ];

    return lines.join('\n');
}

function formatCompressedBatch(batchId, exportResults, skippedUsers) {
    const timestamp = new Date().toISOString();
    const totalUsers = exportResults.length + skippedUsers.length;

    const lines = [
        `IT-HUB|EXPORT|BATCH|${timestamp}|${batchId}|${totalUsers}|${exportResults.length}|${skippedUsers.length}`
    ];

    exportResults.forEach(({ user, credentials }) => {
        const sortedCredentials = [...credentials].sort((a, b) => {
            const idA = a.systemConfig?.systemId || a.systemId || a.system || '';
            const idB = b.systemConfig?.systemId || b.systemId || b.system || '';
            return idA.localeCompare(idB);
        });

        const userName = user.displayName || user.email || user.username || user.ldapUsername || '';
        const userEmail = user.email || '';

        lines.push(`USER|${user.id}|${escapeField(userName)}|${escapeField(userEmail)}`);
        sortedCredentials.forEach(cred => {
            lines.push(
                `${escapeField(cred.systemConfig?.systemId || cred.systemId || cred.system)}|${escapeField(cred.username)}|${escapeField(cred.password)}`
            );
        });
    });

    return lines.join('\n');
}
