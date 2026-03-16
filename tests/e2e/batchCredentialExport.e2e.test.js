
/**
 * Batch Credential Export E2E Tests
 * 
 * Tests for Story 3.2: Batch Credential Export
 */

import { test, expect } from '@playwright/test';
import { webBaseUrl, webUrl } from './baseUrls.js';

const readDownloadContent = async (download) => {
    const stream = await download.createReadStream();
    if (!stream) return '';
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
};

test.describe('Batch Credential Export E2E', () => {
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

    test('IT user can select multiple users and export batch', async ({ page }) => {
        // Navigate to users page
        await page.goto(webUrl('/users'));

        // Wait for list to load
        await expect(page.locator('.users-table')).toBeVisible();

        // Select all checkbox
        const selectAllCheckbox = page.locator('input[aria-label="Select all users"]');
        await expect(selectAllCheckbox).toBeVisible();

        // Select specific users
        // Assuming generated users have specific IDs or we rely on position
        const userCheckboxes = page.locator('tbody input[type="checkbox"]');
        const count = await userCheckboxes.count();

        // Ensure we have users
        if (count < 2) {
            // Create users via API if missing?
            // For now assume seeded data
        }

        await userCheckboxes.first().check();
        if (count > 1) {
            await userCheckboxes.nth(1).check();
        }

        // Export button should appear
        const exportButton = page.getByRole('button', { name: 'Export Selected Credentials' });
        await expect(exportButton).toBeVisible();

        // Should download a file
        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();
        const download = await downloadPromise;

        // Verify filename format
        const filename = download.suggestedFilename();
        expect(filename).toMatch(/^batch-credentials-.*\.txt$/);

        // Download and read file content
        const fileContent = await readDownloadContent(download);

        // Verify export format
        expect(fileContent).toContain('IT-HUB BATCH CREDENTIAL EXPORT');
        expect(fileContent).toContain('Generated:');
        expect(fileContent).toContain('Batch ID:');
        expect(fileContent).toContain('Total Users:'); // e.g. 2
        expect(fileContent).toContain('Successful Exports:');
        expect(fileContent).toContain('Skipped Users:');

        // Verify user sections
        expect(fileContent).toContain('USER 1 OF');
        expect(fileContent).toContain('=================================');
    });

    test('Export button hidden when no users selected', async ({ page }) => {
        await page.goto(webUrl('/users'));

        // Ensure no users selected initially
        const exportButton = page.getByRole('button', { name: 'Export Selected Credentials' });
        await expect(exportButton).not.toBeVisible();

        // Select one user
        await page.locator('tbody input[type="checkbox"]').first().check();
        await expect(exportButton).toBeVisible();

        // Deselect
        await page.locator('tbody input[type="checkbox"]').first().uncheck();
        await expect(exportButton).not.toBeVisible();
    });

    test('Export button hidden for non-IT users', async ({ page }) => {
        // Logout and login as requester
        await page.goto(webUrl('/logout'));

        await page.goto(webUrl('/login'));
        await page.fill('[name="username"]', 'test-requester');
        await page.fill('[name="password"]', 'test-password');
        await page.click('button[type="submit"]');

        await page.goto(webUrl('/users'));

        // Checkboxes should NOT be visible
        const selectAllCheckbox = page.locator('input[aria-label="Select all users"]');
        await expect(selectAllCheckbox).not.toBeVisible();

        const userCheckboxes = page.locator('tbody input[type="checkbox"]');
        await expect(userCheckboxes).not.toBeVisible();
    });
});
