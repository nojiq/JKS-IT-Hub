import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readCss = (relativePath) => readFileSync(path.resolve(__dirname, relativePath), 'utf8');

describe('Stitch theme styles', () => {
    it('maps the global UI tokens to the Stitch IT Hub design system', () => {
        const css = readCss('../src/styles/index.css');

        expect(css).toContain('family=Inter:wght@400;500;600;700;900');
        expect(css).toContain('family=JetBrains+Mono:wght@400;500;600;700');
        expect(css).toMatch(/--ui-surface-canvas:\s*#fbf9fa;/);
        expect(css).toMatch(/--ui-surface-elevated:\s*#ffffff;/);
        expect(css).toMatch(/--ui-text-primary:\s*#1b1b1d;/);
        expect(css).toMatch(/--ui-accent-primary:\s*#334155;/);
        expect(css).toMatch(/--font-heading:\s*"Inter"/);
        expect(css).toMatch(/--font-body:\s*"Inter"/);
        expect(css).toMatch(/--bg-body:\s*var\(--ui-surface-canvas\);/);
        expect(css).toMatch(/--radius-control:\s*4px;/);
        expect(css).toMatch(/--radius-panel:\s*8px;/);
    });

    it('styles the login surface as the light enterprise Stitch login', () => {
        const css = readCss('../src/styles/index.css');

        expect(css).toMatch(/\.auth-card[\s\S]*?width:\s*min\(440px, 92vw\)/);
        expect(css).toMatch(/\.auth-card[\s\S]*?border-radius:\s*var\(--radius-panel\)/);
        expect(css).toMatch(/\.auth-card[\s\S]*?box-shadow:\s*var\(--shadow-sm\)/);
        expect(css).toMatch(/\.auth-field input[\s\S]*?height:\s*40px/);
        expect(css).toMatch(/\.auth-submit[\s\S]*?height:\s*40px/);
        expect(css).toMatch(/\.auth-submit[\s\S]*?background:\s*var\(--ui-accent-primary\)/);
    });
});
