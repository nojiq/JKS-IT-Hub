import { test } from 'node:test';
import assert from 'node:assert';
import {
    formatSingleUserExport,
    formatBatchExport,
    formatSystemEntry,
    formatExportHeader,
    FORMAT_TYPES
} from '../../apps/api/src/features/exports/formatter.js';

test('Export Formatter - Constants', async (t) => {
    await t.test('FORMAT_TYPES should be defined', () => {
        assert.deepStrictEqual(FORMAT_TYPES, {
            STANDARD: 'standard',
            COMPRESSED: 'compressed'
        });
    });
});

test('Export Formatter - formatSystemEntry', async (t) => {
    await t.test('should format system entry correctly', () => {
        const credential = {
            username: 'jdoe',
            password: 'password123',
            systemConfig: {
                systemId: 'test-system',
                description: 'Test System'
            }
        };

        const lines = formatSystemEntry(credential);

        assert.strictEqual(lines[0], '---------------------------------');
        assert.strictEqual(lines[1], 'Test System');
        assert.strictEqual(lines[2], 'Username: jdoe');
        assert.strictEqual(lines[3], 'Password: password123');
        assert.strictEqual(lines[4], '---------------------------------');
        assert.strictEqual(lines[5], '');
    });

    await t.test('should use systemId if description is missing', () => {
        const credential = {
            username: 'jdoe',
            password: 'password123',
            systemConfig: {
                systemId: 'test-system'
            }
        };

        const lines = formatSystemEntry(credential);
        assert.strictEqual(lines[1], 'test-system');
    });
});

test('Export Formatter - formatExportHeader', async (t) => {
    await t.test('should format single user header', () => {
        const user = {
            displayName: 'John Doe',
            email: 'john@example.com'
        };
        const metadata = { systemCount: 5 };

        const lines = formatExportHeader('single', user, metadata);

        assert.strictEqual(lines[0], 'IT-HUB CREDENTIAL EXPORT');
        assert.match(lines[1], /^Generated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        assert.strictEqual(lines[2], 'User: John Doe (john@example.com)');
        assert.strictEqual(lines[3], 'Systems: 5');
        assert.strictEqual(lines[4], '');
    });

    await t.test('should format batch header', () => {
        const metadata = {
            batchId: 'batch-123',
            totalUsers: 10,
            successfulExports: 8,
            skippedUsers: 2
        };

        const lines = formatExportHeader('batch', null, metadata);

        assert.strictEqual(lines[0], 'IT-HUB BATCH CREDENTIAL EXPORT');
        assert.match(lines[1], /^Generated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        assert.strictEqual(lines[2], 'Batch ID: batch-123');
        assert.strictEqual(lines[3], 'Total Users: 10');
        assert.strictEqual(lines[4], 'Successful Exports: 8');
        assert.strictEqual(lines[5], 'Skipped Users: 2');
        assert.strictEqual(lines[6], '');
    });
});

test('Export Formatter - formatSingleUserExport', async (t) => {
    const user = {
        displayName: 'John Doe',
        email: 'john@example.com'
    };

    const credentials = [
        {
            username: 'user2',
            password: 'pass2',
            systemConfig: { systemId: 'system-b', description: 'System B' }
        },
        {
            username: 'user1',
            password: 'pass1',
            systemConfig: { systemId: 'system-a', description: 'System A' }
        }
    ];

    await t.test('should format standard export with sorted systems', () => {
        const output = formatSingleUserExport(user, credentials, FORMAT_TYPES.STANDARD);

        // Check sorting (System A should come before System B)
        const indexA = output.indexOf('System A');
        const indexB = output.indexOf('System B');
        assert.ok(indexA < indexB, 'Systems should be sorted alphabetically by systemId');

        assert.ok(output.includes('IT-HUB CREDENTIAL EXPORT'));
        assert.ok(output.includes('User: John Doe (john@example.com)'));
    });

    await t.test('should include End of export footer', () => {
        const output = formatSingleUserExport(user, credentials, FORMAT_TYPES.STANDARD);
        assert.ok(output.includes('End of export'));
    });

    await t.test('should format compressed export correctly', () => {
        const output = formatSingleUserExport(user, credentials, FORMAT_TYPES.COMPRESSED);
        const lines = output.split('\n');

        // First line should be header
        assert.match(lines[0], /^IT-HUB\|EXPORT\|SINGLE\|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\|John Doe\|john@example\.com$/);

        // Credentials should be pipe-delimited
        assert.match(lines[1], /^system-a\|user1\|pass1$/);
        assert.match(lines[2], /^system-b\|user2\|pass2$/);

        // Should not contain decorative delimiters
        assert.ok(!output.includes('---------------------------------'));
        assert.ok(!output.includes('Username:'));
        assert.ok(!output.includes('Password:'));
    });
});

test('Export Formatter - Format Consistency', async (t) => {
    const user = {
        displayName: 'John Doe',
        email: 'john@example.com'
    };

    const credentials = [
        {
            username: 'jdoe',
            password: 'AbCdEfGh12#!',
            systemConfig: { systemId: 'active-directory', description: 'Active Directory' }
        },
        {
            username: 'john.doe',
            password: 'P@ssw0rd2026!',
            systemConfig: { systemId: 'file-server', description: 'File Server' }
        }
    ];

    await t.test('batch export should use same system entry format as single-user', () => {
        const singleOutput = formatSingleUserExport(user, credentials, FORMAT_TYPES.STANDARD);
        const batchOutput = formatBatchExport('batch-123', [{ user, credentials }], [], FORMAT_TYPES.STANDARD);

        // Extract system entries (between delimiters)
        const singleSystems = singleOutput.split('---------------------------------').filter(s => s.includes('Username:'));
        const batchSystems = batchOutput.split('---------------------------------').filter(s => s.includes('Username:'));

        // Should have same system entries
        singleSystems.forEach((entry, index) => {
            assert.strictEqual(entry.trim(), batchSystems[index].trim());
        });
    });

    await t.test('format should be identical for same data exported via single vs batch (for individual user)', () => {
        const singleOutput = formatSingleUserExport(user, credentials, FORMAT_TYPES.STANDARD);
        const batchOutput = formatBatchExport('batch-123', [{ user, credentials }], [], FORMAT_TYPES.STANDARD);

        // Both should contain same system credentials
        credentials.forEach(cred => {
            assert.ok(singleOutput.includes(`Username: ${cred.username}`));
            assert.ok(singleOutput.includes(`Password: ${cred.password}`));
            assert.ok(batchOutput.includes(`Username: ${cred.username}`));
            assert.ok(batchOutput.includes(`Password: ${cred.password}`));
        });
    });
});

test('Export Formatter - Alphabetical Sorting', async (t) => {
    const user = {
        displayName: 'Test User',
        email: 'test@example.com'
    };

    await t.test('should sort credentials alphabetically by systemId', () => {
        // Deliberately unsorted credentials
        const unsortedCreds = [
            { username: 'u1', password: 'p1', systemConfig: { systemId: 'vpn', description: 'VPN' } },
            { username: 'u2', password: 'p2', systemConfig: { systemId: 'active-directory', description: 'AD' } },
            { username: 'u3', password: 'p3', systemConfig: { systemId: 'file-server', description: 'File Server' } }
        ];

        const output = formatSingleUserExport(user, unsortedCreds, FORMAT_TYPES.STANDARD);

        // Find positions of system names
        const adIndex = output.indexOf('AD');
        const fsIndex = output.indexOf('File Server');
        const vpnIndex = output.indexOf('VPN');

        // Verify alphabetical order
        assert.ok(adIndex < fsIndex, 'active-directory should come before file-server');
        assert.ok(fsIndex < vpnIndex, 'file-server should come before vpn');
    });
});

test('Export Formatter - Special Character Handling', async (t) => {
    const user = {
        displayName: 'Test User',
        email: 'test@example.com'
    };

    await t.test('should escape pipe characters in compressed format passwords', () => {
        const creds = [{
            username: 'user1',
            password: 'Pass|word123',
            systemConfig: { systemId: 'test-system', description: 'Test' }
        }];

        const output = formatSingleUserExport(user, creds, FORMAT_TYPES.COMPRESSED);

        // Pipe should be escaped
        assert.ok(output.includes('Pass\\|word123'));
        assert.ok(!output.includes('|word123|'), 'Unescaped pipe would break parsing');
    });

    await t.test('should escape newlines in compressed format passwords', () => {
        const creds = [{
            username: 'user1',
            password: 'Pass\nword123',
            systemConfig: { systemId: 'test-system', description: 'Test' }
        }];

        const output = formatSingleUserExport(user, creds, FORMAT_TYPES.COMPRESSED);

        // Newline should be escaped
        assert.ok(output.includes('Pass\\nword123'));
    });

    await t.test('should handle special characters in passwords (standard format)', () => {
        const creds = [{
            username: 'user1',
            password: 'P@ssw0rd!#$%^&*(){}[]',
            systemConfig: { systemId: 'test-system', description: 'Test' }
        }];

        const output = formatSingleUserExport(user, creds, FORMAT_TYPES.STANDARD);

        // Standard format preserves special characters
        assert.ok(output.includes('P@ssw0rd!#$%^&*(){}[]'));
    });

    await t.test('should preserve Unicode characters in usernames and system names', () => {
        const creds = [{
            username: 'użytkownik', // Polish
            password: 'pass',
            systemConfig: { systemId: 'test', description: '系統' } // Chinese
        }];

        const output = formatSingleUserExport(user, creds, FORMAT_TYPES.STANDARD);

        // Unicode should be preserved
        assert.ok(output.includes('użytkownik'));
        assert.ok(output.includes('系統'));
    });
});

test('Export Formatter - Line Ending Normalization', async (t) => {
    const user = {
        displayName: 'Test User',
        email: 'test@example.com'
    };

    const credentials = [{
        username: 'user1',
        password: 'pass1',
        systemConfig: { systemId: 'test-system', description: 'Test' }
    }];

    await t.test('should use LF only (no CRLF) for line endings', () => {
        const output = formatSingleUserExport(user, credentials, FORMAT_TYPES.STANDARD);

        // Should not contain CRLF
        assert.ok(!output.includes('\r\n'), 'Should not contain CRLF line endings');

        // Should contain LF
        assert.ok(output.includes('\n'), 'Should contain LF line endings');
    });
});
