import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readCss = (relativePath) => readFileSync(path.resolve(__dirname, relativePath), 'utf8');

describe('Overview metric strip styles', () => {
    it('renders request overview metrics as a compact strip', () => {
        const css = readCss('../src/features/requests/pages/RequestsHomePage.css');

        expect(css).toMatch(/\.requests-overview-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
        expect(css).toMatch(/\.requests-overview-grid\s*\{[^}]*border-top:\s*1px solid var\(--ui-border-subtle\)/s);
        expect(css).toMatch(/\.requests-overview-card\s*\{[^}]*min-height:\s*0/s);
    });

    it('renders maintenance overview metrics as a compact strip', () => {
        const css = readCss('../src/features/maintenance/pages/MaintenanceHomePage.css');

        expect(css).toMatch(/\.maintenance-overview-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
        expect(css).toMatch(/\.maintenance-overview-grid\s*\{[^}]*border-top:\s*1px solid var\(--ui-border-subtle\)/s);
        expect(css).toMatch(/\.maintenance-overview-card\s*\{[^}]*min-height:\s*0/s);
    });
});
