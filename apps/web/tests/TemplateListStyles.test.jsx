import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readCss = (relativePath) => readFileSync(path.resolve(__dirname, relativePath), 'utf8');

describe('template list dark mode styles', () => {
    it('uses theme tokens for the page shell and cards', () => {
        const css = readCss('../src/features/credentials/templates/templates.css');

        expect(css).toMatch(/\.template-page\s*\{[^}]*background:\s*var\(--color-background\)/s);
        expect(css).toMatch(/\.template-card\s*\{[^}]*background:\s*var\(--color-surface\)/s);
        expect(css).toMatch(/\.template-card\s*\{[^}]*border:\s*1px solid var\(--color-border\)/s);
        expect(css).toMatch(/\.empty-state\s*\{[^}]*background:\s*var\(--color-surface\)/s);
    });

    it('uses theme tokens for list typography, badges, and buttons', () => {
        const css = readCss('../src/features/credentials/templates/templates.css');

        expect(css).toMatch(/\.page-header h1\s*\{[^}]*color:\s*var\(--color-text-primary\)/s);
        expect(css).toMatch(/\.description\s*\{[^}]*color:\s*var\(--text-muted\)/s);
        expect(css).toMatch(/\.meta\s*\{[^}]*color:\s*var\(--text-muted\)/s);
        expect(css).toMatch(/\.badge\.active\s*\{[^}]*background:\s*var\(--color-success-muted\)/s);
        expect(css).toMatch(/\.btn-secondary\s*\{[^}]*background:\s*var\(--color-surface\)/s);
    });
});
