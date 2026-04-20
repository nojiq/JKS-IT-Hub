import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readCss = (relativePath) => readFileSync(path.resolve(__dirname, relativePath), 'utf8');

describe('catalog page styling contract', () => {
    it('scopes compact actions, placeholder contrast, and refined empty states to the catalog page', () => {
        const css = readCss('../src/features/onboarding/onboarding.css');

        expect(css).toMatch(/\.catalog-page-shell\s*\{[^}]*width:\s*100%/s);
        expect(css).toMatch(/\.catalog-page-grid\s*\{[^}]*width:\s*100%/s);
        expect(css).toMatch(/\.catalog-page-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/s);
        expect(css).toMatch(/\.catalog-form-footer\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/s);
        expect(css).toMatch(/\.catalog-page\s+\.catalog-button\s*\{[^}]*min-height:\s*2\.25rem/s);
        expect(css).toMatch(/\.catalog-page\s+\.catalog-button\s*\{[^}]*border-radius:\s*10px/s);
        expect(css).toMatch(/\.catalog-page\s+\.catalog-switch-input\s*\{[^}]*position:\s*absolute/s);
        expect(css).toMatch(/\.catalog-page\s+\.catalog-switch-track\s*\{[^}]*width:\s*2\.5rem/s);
        expect(css).toMatch(/\.catalog-page\s+\.catalog-switch-input:checked\s*\+\s*\.catalog-switch-track\s*\{[^}]*background:\s*var\(--ui-accent-primary\)/s);
        expect(css).toMatch(/\.catalog-page\s+\.catalog-empty-state\s*\{[^}]*border:\s*1px solid var\(--ui-border-subtle\)/s);
        expect(css).toMatch(/\.catalog-page\s+\.catalog-empty-state\s*\{[^}]*box-shadow:\s*0 12px 30px/s);
        expect(css).toMatch(/\.catalog-page\s+\.catalog-empty-state\s*\{[^}]*display:\s*grid/s);
        expect(css).toMatch(/\.catalog-page\s+\.catalog-empty-state\s*\{[^}]*width:\s*100%/s);
        expect(css).toMatch(/\.catalog-page\s+\.catalog-selection-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(15\.5rem,\s*100%\),\s*1fr\)\)/s);
        expect(css).toMatch(/\.catalog-page\s+\.onboarding-form-field\s+input::placeholder,[\s\S]*?\.catalog-page\s+\.onboarding-form-field\s+textarea::placeholder\s*\{[^}]*color:\s*var\(--ui-text-secondary\)/s);
        expect(css).toMatch(/\.catalog-page\s+\.onboarding-form-field\s+input::placeholder,[\s\S]*?\.catalog-page\s+\.onboarding-form-field\s+textarea::placeholder\s*\{[^}]*opacity:\s*1/s);
        expect(css).toMatch(/\.catalog-page\s+\.onboarding-card\s*\{[^}]*box-shadow:\s*0 18px 44px/s);
    });
});
