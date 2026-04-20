import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readCss = (relativePath) => readFileSync(path.resolve(__dirname, relativePath), 'utf8');

describe('system management layout containment styles', () => {
    it('keeps page width inside workspace shell and lets main column shrink', () => {
        const css = readCss('../src/styles/index.css');

        expect(css).toMatch(/\.system-management-page\s*\{[^}]*width:\s*100%/s);
        expect(css).toMatch(/\.system-management-page\s*\{[^}]*max-width:\s*100%/s);
        expect(css).toMatch(/\.management-layout\s*\{[^}]*grid-template-columns:\s*minmax\([^)]*\)\s+minmax\(0,\s*1fr\)/s);
        expect(css).toMatch(/\.management-main\s*\{[^}]*min-width:\s*0/s);
        expect(css).toMatch(/\.management-main\s*>\s*\.workspace-panel[\s\S]*?\{[^}]*min-width:\s*0/s);
    });

    it('forces long system catalog values to wrap inside table cells', () => {
        const css = readCss('../src/styles/index.css');

        expect(css).toMatch(/\.system-config-list\s+\.data-table\s*\{[^}]*table-layout:\s*fixed/s);
        expect(css).toMatch(/\.system-config-list\s+\.data-table\s+td\s*\{[^}]*overflow-wrap:\s*anywhere/s);
        expect(css).toMatch(/\.system-id-cell\s*,[\s\S]*?\.system-config-list\s+\.data-table\s+code\s*\{[^}]*word-break:\s*break-word/s);
        expect(css).toMatch(/\.row-actions\s*\{[^}]*flex-wrap:\s*wrap/s);
    });
});
