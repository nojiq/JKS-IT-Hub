import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readCss = (relativePath) => readFileSync(path.resolve(__dirname, relativePath), 'utf8');

describe('WorkspacePanel workspace sheet styling', () => {
    it('uses flat section styling instead of card elevation', () => {
        const css = readCss('../src/shared/workspace/workspace.css');

        expect(css).toMatch(/\.workspace-panel\s*\{[^}]*border-top:\s*1px solid var\(--ui-border-subtle\)/s);
        expect(css).toMatch(/\.workspace-panel\s*\{[^}]*border-bottom:\s*1px solid var\(--ui-border-subtle\)/s);
        expect(css).toMatch(/\.workspace-panel\s*\{[^}]*border-radius:\s*0/s);
        expect(css).toMatch(/\.workspace-panel\s*\{[^}]*box-shadow:\s*none/s);
    });

    it('keeps panel headers quiet and flush with the workspace surface', () => {
        const css = readCss('../src/shared/workspace/workspace.css');

        expect(css).toMatch(/\.workspace-panel-header-band\s*\{[^}]*padding:\s*0\.85rem 0/s);
        expect(css).toMatch(/\.workspace-panel-header-band\s*\{[^}]*background:\s*transparent/s);
        expect(css).toMatch(/\.workspace-panel-body\s*\{[^}]*padding:\s*1rem 0/s);
    });
});
