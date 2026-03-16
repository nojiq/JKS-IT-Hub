/**
 * Credential Export E2E Tests
 * 
 * Tests for Story 3.1: Single-User Credential Export
 * End-to-end tests covering the full export flow
 * 
 * These tests should be run with an E2E framework like Playwright or Cypress.
 * The examples below use Playwright syntax but can be adapted as needed.
 */

import { test, expect } from '@playwright/test';
import { apiUrl, webBaseUrl, webUrl } from './baseUrls.js';

const readDownloadContent = async (download) => {
  const stream = await download.createReadStream();
  if (!stream) return '';
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

test.describe('Credential Export E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto(webUrl('/login'));

    // Login as IT user
    await page.fill('[name="username"]', 'test-it-user');
    await page.fill('[name="password"]', 'test-password');
    await page.click('button[type="submit"]');

    // Wait for successful login
    await page.waitForURL(`${webBaseUrl}/`);
  });

  test('IT user can export credentials end-to-end', async ({ page }) => {
    // Navigate to users page
    await page.goto(webUrl('/users'));

    // Find a user with credentials and click their detail page
    const userRow = page.locator('tr', { hasText: 'test-user-with-creds' }).first();
    await userRow.click();

    // Should be on user detail page
    await expect(page).toHaveURL(/\/users\/.+/);

    // Find export button (should only be visible to IT users)
    const exportButton = page.getByRole('button', { name: 'Export Credentials' });
    await expect(exportButton).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();

    // Should show loading state
    await expect(exportButton).toHaveText('Exporting...');

    // Should download a file
    const download = await downloadPromise;

    // Verify filename format
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^credentials-[a-f0-9-]{36}-\d{4}-\d{2}-\d{2}\.txt$/);

    // Download and read file content
    const fileContent = await readDownloadContent(download);

    // Verify export format
    expect(fileContent).toContain('IT-HUB CREDENTIAL EXPORT');
    expect(fileContent).toContain('Generated:');
    expect(fileContent).toContain('User:');
    expect(fileContent).toContain('Systems:');

    // Should show success notification
    await expect(page.getByText('Credentials exported successfully')).toBeVisible();
  });

  test('exported file matches expected format', async ({ page }) => {
    // Set up user with known credentials
    await page.goto(webUrl('/users/test-user-123'));

    const exportButton = page.getByRole('button', { name: 'Export Credentials' });
    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();

    const download = await downloadPromise;
    const fileContent = await readDownloadContent(download);

    // Verify structure
    const lines = fileContent.split('\n');
    
    // First line should be title
    expect(lines[0]).toBe('IT-HUB CREDENTIAL EXPORT');

    // Should have generated timestamp
    expect(fileContent).toMatch(/Generated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/);

    // Should have user info
    expect(fileContent).toMatch(/User: .+/);

    // Should have system count
    expect(fileContent).toMatch(/Systems: \d+/);

    // Should have at least one credential entry if user has credentials
    if (fileContent.includes('Systems: 1') || fileContent.includes('Systems: 2')) {
      expect(fileContent).toMatch(/-{20,}/); // Separator lines
      expect(fileContent).toMatch(/Username: .+/);
      expect(fileContent).toMatch(/Password: .+/);
    }

    // Should have end marker
    expect(lines[lines.length - 1]).toBe('End of export');
  });

  test('IMAP credentials excluded from exported file', async ({ page, request }) => {
    // First verify user has IMAP credentials through API
    const userCredentialsResponse = await request.get(apiUrl('/api/v1/credentials/test-user-123'), {
      headers: {
        'Authorization': 'Bearer test-it-token'
      }
    });

    const userCredentials = await userCredentialsResponse.json();
    const hasImapCredentials = userCredentials.data?.some(
      cred => cred.system === 'imap' || cred.systemConfig?.isItOnly === true
    );

    if (!hasImapCredentials) {
      // Set up user with IMAP credentials via test API
      await request.post(apiUrl('/api/v1/system-configs'), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-it-token'
        },
        data: {
          systemId: 'imap-test',
          usernameLdapField: 'mail',
          isItOnly: true
        }
      });
    }

    // Export credentials
    await page.goto(webUrl('/users/test-user-123'));
    const exportButton = page.getByRole('button', { name: 'Export Credentials' });
    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();

    const download = await downloadPromise;
    const fileContent = await readDownloadContent(download);

    // IMAP should NOT appear in export
    expect(fileContent.toLowerCase()).not.toContain('imap');
    expect(fileContent.toLowerCase()).not.toContain('test-imap');
  });

  test('export fails for non-IT users', async ({ page }) => {
    // Logout IT user and login as requester
    await page.goto(webUrl('/logout'));

    // Login as non-IT user
    await page.goto(webUrl('/login'));
    await page.fill('[name="username"]', 'test-requester-user');
    await page.fill('[name="password"]', 'test-password');
    await page.click('button[type="submit"]');

    // Navigate to user detail page
    await page.goto(webUrl('/users/test-user-123'));

    // Export button should NOT be visible for non-IT users
    const exportButton = page.getByRole('button', { name: 'Export Credentials' });
    await expect(exportButton).not.toBeVisible();

    // Try calling API directly (should get 403)
    const apiResponse = await page.request.get(apiUrl('/api/v1/users/test-user-123/credentials/export'));

    expect(apiResponse.status()).toBe(403);
    const error = await apiResponse.json();
    expect(error.title).toBe('Unauthorized');
    expect(error.detail).toContain('IT role required');
  });

  test('export audit log entry created', async ({ page, request }) => {
    // Get user ID from page or use known test user
    const userId = 'test-user-123';

    // Get initial audit log count
    const initialAuditLogs = await request.get(
      apiUrl(`/api/v1/users/${userId}/audit-logs`),
      {
        headers: {
          'Authorization': 'Bearer test-it-token'
        }
      }
    );

    const initialAuditLogsBody = await initialAuditLogs.json();
    const initialCount = (initialAuditLogsBody.logs ?? []).filter(
      log => log.action === 'credentials.export.single_user'
    ).length;

    // Perform export
    await page.goto(webUrl(`/users/${userId}`));
    const exportButton = page.getByRole('button', { name: 'Export Credentials' });
    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();
    await downloadPromise;

    // Wait for audit log to be created
    await page.waitForTimeout(1000);

    // Check audit log for export action
    const auditLogsResponse = await request.get(
      apiUrl(`/api/v1/users/${userId}/audit-logs?action=credentials.export.single_user`),
      {
        headers: {
          'Authorization': 'Bearer test-it-token'
        }
      }
    );

    const auditLogsBody = await auditLogsResponse.json();
    const exportLogs = (auditLogsBody.logs ?? []).filter(
      log => log.action === 'credentials.export.single_user'
    );

    // Should have created at least one audit log entry
    expect(exportLogs.length).toBeGreaterThan(initialCount);

    // Verify audit log structure
    const latestExportLog = exportLogs[0];
    expect(latestExportLog.action).toBe('credentials.export.single_user');
    expect(latestExportLog.entityId).toBe(userId);
    expect(latestExportLog.metadata).toBeDefined();
    expect(latestExportLog.metadata.credentialCount).toBeDefined();
    expect(latestExportLog.metadata.exportedSystems).toBeDefined();
    expect(latestExportLog.metadata.exportTimestamp).toBeDefined();

    // exportedSystems should NOT contain IMAP (filtered out)
    if (latestExportLog.metadata.exportedSystems) {
      expect(latestExportLog.metadata.exportedSystems).not.toContain('imap');
    }
  });

  test('export fails for disabled users', async ({ page, request }) => {
    const disabledUserId = 'test-disabled-user-id';

    // Verify user is disabled through API
    const userResponse = await request.get(apiUrl(`/api/v1/users/${disabledUserId}`), {
      headers: {
        'Authorization': 'Bearer test-it-token'
      }
    });

    const user = await userResponse.json();
    expect(user?.data?.status).toBe('disabled');

    // Navigate to user detail page
    await page.goto(webUrl(`/users/${disabledUserId}`));

    // Export button might be visible but should be disabled
    const exportButton = page.getByRole('button', { name: 'Export Credentials' });
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeDisabled();

    // Try API directly
    const apiResponse = await page.request.get(
      apiUrl(`/api/v1/users/${disabledUserId}/credentials/export`)
    );

    expect(apiResponse.status()).toBe(403);
    const error = await apiResponse.json();
    expect(error.title).toBe('User Disabled');
    expect(error.detail).toContain('Cannot export credentials for disabled user');
  });

  test('export works correctly with empty credential list', async ({ page }) => {
    // Navigate to user with no credentials
    await page.goto(webUrl('/users/test-no-creds-user'));

    const exportButton = page.getByRole('button', { name: 'Export Credentials' });
    
    // Button should still be enabled to allow attempted export
    await expect(exportButton).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();

    const download = await downloadPromise;
    const fileContent = await readDownloadContent(download);

    // Should still export but with 0 systems
    expect(fileContent).toContain('Systems: 0');
    expect(fileContent).not.toContain('Username:');
    expect(fileContent).not.toContain('Password:');
  });

  test('export performance meets 5 second SLA', async ({ page }) => {
    const userId = 'test-user-123';

    await page.goto(webUrl(`/users/${userId}`));

    const startTime = Date.now();

    const exportButton = page.getByRole('button', { name: 'Export Credentials' });
    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();

    // Wait for download to start
    await downloadPromise;

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Export should complete within 5 seconds
    expect(duration).toBeLessThan(5000);
  });
});
