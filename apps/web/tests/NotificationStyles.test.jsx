import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readCss = (relativePath) => readFileSync(path.resolve(__dirname, relativePath), 'utf8');

describe('notification dark mode styles', () => {
    it('uses theme tokens for the dropdown and list surfaces', () => {
        const bellCss = readCss('../src/features/notifications/components/NotificationBell.css');
        const listCss = readCss('../src/features/notifications/components/NotificationList.css');

        expect(bellCss).toMatch(/\.notification-dropdown\s*\{[^}]*background:\s*var\(--color-surface\)/s);
        expect(listCss).toMatch(/\.notification-list\s*\{[^}]*background:\s*var\(--color-surface\)/s);
        expect(listCss).toMatch(/\.notification-actions\s*\{[^}]*background:\s*var\(--color-surface\)/s);
        expect(listCss).toMatch(/\.view-all\s*\{[^}]*background:\s*var\(--color-surface\)/s);
    });

    it('uses theme tokens for notification item states and text', () => {
        const itemCss = readCss('../src/features/notifications/components/NotificationItem.css');

        expect(itemCss).toMatch(/\.notification-item\s*\{[^}]*border-bottom:\s*1px solid var\(--color-border\)/s);
        expect(itemCss).toMatch(/\.notification-item\.unread\s*\{[^}]*background-color:\s*var\(--color-primary-muted\)/s);
        expect(itemCss).toMatch(/\.notification-title\s*\{[^}]*color:\s*var\(--color-text-primary\)/s);
        expect(itemCss).toMatch(/\.notification-time\s*\{[^}]*color:\s*var\(--text-muted\)/s);
        expect(itemCss).toMatch(/\.notification-message\s*\{[^}]*color:\s*var\(--color-text-secondary\)/s);
    });
});
