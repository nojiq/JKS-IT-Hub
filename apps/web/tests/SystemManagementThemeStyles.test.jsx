import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readCss = (relativePath) => readFileSync(path.resolve(__dirname, relativePath), 'utf8');

describe('system management dark mode styles', () => {
    it('uses theme tokens for scope selectors and the preview surface', () => {
        const css = readCss('../src/styles/index.css');

        expect(css).toMatch(/\.scope-selector\s*\{[^}]*background:\s*var\(--color-surface\)/s);
        expect(css).toMatch(/\.scope-selector:hover\s*\{[^}]*background:\s*var\(--color-surface-hover\)/s);
        expect(css).toMatch(/\.scope-selector\.active\s*\{[^}]*background:\s*var\(--color-primary-muted\)/s);
        expect(css).toMatch(/\.normalization-previewer\s*\{[^}]*background:\s*var\(--ui-surface-muted\)/s);
        expect(css).toMatch(/\.preview-results\s*\{[^}]*border-top:\s*1px dashed var\(--color-border\)/s);
    });

    it('uses theme tokens for rule controls and interactive states', () => {
        const css = readCss('../src/styles/index.css');

        expect(css).toMatch(/\.selector-trigger\s*\{[^}]*background:\s*var\(--color-surface\)/s);
        expect(css).toMatch(/\.dropdown-menu\s*\{[^}]*background:\s*var\(--color-surface\)/s);
        expect(css).toMatch(/\.field-option:hover\s*\{[^}]*background:\s*var\(--color-surface-hover\)/s);
        expect(css).toMatch(/\.field-option\.selected\s*\{[^}]*background:\s*var\(--color-primary-muted\)/s);
        expect(css).toMatch(/\.rule-item\s*\{[^}]*background:\s*var\(--color-surface\)/s);
        expect(css).toMatch(/\.btn-move\s*\{[^}]*background:\s*var\(--color-surface\)/s);
        expect(css).toMatch(/\.rule-badge\s*\{[^}]*background:\s*var\(--color-primary-muted\)/s);
        expect(css).toMatch(/\.btn-link:hover\s*\{[^}]*background:\s*var\(--color-primary-muted\)/s);
    });
});
