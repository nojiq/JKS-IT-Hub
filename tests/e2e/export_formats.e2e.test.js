/**
 * Export Format End-to-End Tests
 *
 * Tests for Story 3.3: Export Formatting Rules.
 * These tests are intended to run with Playwright.
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

test.describe('Export Format End-to-End Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(webUrl('/login'));
        await page.fill('input[name="username"]', 'it-user');
        await page.fill('input[name="password"]', 'password');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(`${webBaseUrl}/`);
    });

    test.describe('Single-User Export', () => {
        test('exports standard format end-to-end', async ({ page }) => {
            await page.goto(webUrl('/users/test-user-id/credentials'));
            await page.selectOption('select[aria-label="Export format"]', 'standard');

            const downloadPromise = page.waitForEvent('download');
            await page.click('button:has-text("Export Credentials")');
            const download = await downloadPromise;

            expect(download.suggestedFilename()).toMatch(/\.txt$/);

            const content = await readDownloadContent(download);
            expect(content).toContain('IT-HUB CREDENTIAL EXPORT');
            expect(content).toMatch(/Generated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
            expect(content).toContain('---------------------------------');
            expect(content).toContain('Username:');
            expect(content).toContain('Password:');
            expect(content).toContain('End of export');
        });

        test('exports compressed format end-to-end', async ({ page }) => {
            await page.goto(webUrl('/users/test-user-id/credentials'));
            await page.selectOption('select[aria-label="Export format"]', 'compressed');

            const downloadPromise = page.waitForEvent('download');
            await page.click('button:has-text("Export Credentials")');
            const download = await downloadPromise;

            expect(download.suggestedFilename()).toMatch(/\.csv$/);

            const content = await readDownloadContent(download);
            expect(content).toMatch(/^IT-HUB\|EXPORT\|SINGLE\|/);
            expect(content).not.toContain('---------------------------------');
            expect(content).not.toContain('Username:');
        });

        test('persists selected format in localStorage', async ({ page }) => {
            await page.goto(webUrl('/users/test-user-id/credentials'));
            await page.selectOption('select[aria-label="Export format"]', 'compressed');

            const storedFormat = await page.evaluate(() =>
                localStorage.getItem('export-format-preference')
            );
            expect(storedFormat).toBe('compressed');

            await page.reload();
            const selected = await page.locator('select[aria-label="Export format"]').inputValue();
            expect(selected).toBe('compressed');
        });
    });

    test.describe('Batch Export', () => {
        test('exports batch standard format', async ({ page }) => {
            await page.goto(webUrl('/users'));
            const userCheckboxes = page.locator('tbody input[type="checkbox"]');
            const count = await userCheckboxes.count();
            test.skip(count < 1, 'No user rows available for batch export');

            await userCheckboxes.first().check();
            if (count > 1) {
                await userCheckboxes.nth(1).check();
            }
            await page.selectOption('select[aria-label="Export format"]', 'standard');

            const downloadPromise = page.waitForEvent('download');
            await page.click('button:has-text("Export Selected Credentials")');
            const download = await downloadPromise;

            expect(download.suggestedFilename()).toMatch(/batch-credentials.*\.txt$/);

            const content = await readDownloadContent(download);
            expect(content).toContain('IT-HUB BATCH CREDENTIAL EXPORT');
            expect(content).toContain('=================================');
        });

        test('exports batch compressed format', async ({ page }) => {
            await page.goto(webUrl('/users'));
            const userCheckboxes = page.locator('tbody input[type="checkbox"]');
            const count = await userCheckboxes.count();
            test.skip(count < 1, 'No user rows available for batch export');

            await userCheckboxes.first().check();
            if (count > 1) {
                await userCheckboxes.nth(1).check();
            }
            await page.selectOption('select[aria-label="Export format"]', 'compressed');

            const downloadPromise = page.waitForEvent('download');
            await page.click('button:has-text("Export Selected Credentials")');
            const download = await downloadPromise;

            expect(download.suggestedFilename()).toMatch(/batch-credentials.*\.csv$/);

            const content = await readDownloadContent(download);
            expect(content).toMatch(/^IT-HUB\|EXPORT\|BATCH\|/);
        });
    });

    test.describe('Format Consistency', () => {
        test('keeps credential lines consistent between single and batch standard exports', async ({ page }) => {
            await page.goto(webUrl('/users/test-user-id/credentials'));
            await page.selectOption('select[aria-label="Export format"]', 'standard');

            const singleDownloadPromise = page.waitForEvent('download');
            await page.click('button:has-text("Export Credentials")');
            const singleDownload = await singleDownloadPromise;
            const singleContent = await readDownloadContent(singleDownload);

            await page.goto(webUrl('/users'));
            const userCheckboxes = page.locator('tbody input[type="checkbox"]');
            const count = await userCheckboxes.count();
            test.skip(count < 1, 'No user rows available for batch export');

            await userCheckboxes.first().check();
            await page.selectOption('select[aria-label="Export format"]', 'standard');

            const batchDownloadPromise = page.waitForEvent('download');
            await page.click('button:has-text("Export Selected Credentials")');
            const batchDownload = await batchDownloadPromise;
            const batchContent = await readDownloadContent(batchDownload);

            const extractCredentialLines = (content) => content
                .split('\n')
                .filter((line) => line.startsWith('Username:') || line.startsWith('Password:'));

            expect(extractCredentialLines(singleContent)).toEqual(extractCredentialLines(batchContent));
        });

        test('produces compressed output parseable by line/field split', async ({ page }) => {
            await page.goto(webUrl('/users/test-user-id/credentials'));
            await page.selectOption('select[aria-label="Export format"]', 'compressed');

            const downloadPromise = page.waitForEvent('download');
            await page.click('button:has-text("Export Credentials")');
            const download = await downloadPromise;
            const content = await readDownloadContent(download);

            const lines = content.split('\n').filter(Boolean);
            const header = lines[0].split('|');
            expect(header[0]).toBe('IT-HUB');
            expect(header[1]).toBe('EXPORT');
            expect(header[2]).toBe('SINGLE');
            expect(header[3]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

            const credentials = lines.slice(1).map((line) => {
                const [systemId, username, password] = line.split('|');
                return { systemId, username, password };
            });

            credentials.forEach((credential) => {
                expect(credential.systemId).toBeTruthy();
                expect(credential.username).toBeTruthy();
                expect(credential.password).toBeTruthy();
            });
        });
    });
});
