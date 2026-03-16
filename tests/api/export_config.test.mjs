import { test } from 'node:test';
import assert from 'node:assert';

import { getExportFormat, FORMAT_CONFIG } from '../../apps/api/src/features/exports/config.js';
import { formatTypeSchema } from '../../apps/api/src/features/exports/schema.js';

test('Export Configuration', async (t) => {
    await t.test('getExportFormat should return correct config for format', () => {
        const standardConfig = getExportFormat('standard');
        assert.deepStrictEqual(standardConfig, FORMAT_CONFIG.STANDARD);
        assert.strictEqual(standardConfig.delimiters.entry, '---------------------------------');

        const compressedConfig = getExportFormat('compressed');
        assert.deepStrictEqual(compressedConfig, FORMAT_CONFIG.COMPRESSED);
        assert.strictEqual(compressedConfig.delimiters.entry, '\n');
    });

    await t.test('getExportFormat should default to standard if invalid/null', () => {
        const config = getExportFormat('unknown');
        assert.deepStrictEqual(config, FORMAT_CONFIG.STANDARD);
    });
});

test('Export Schema', async (t) => {
    await t.test('formatTypeSchema should validate correct format types', () => {
        assert.ok(formatTypeSchema.safeParse('standard').success);
        assert.ok(formatTypeSchema.safeParse('compressed').success);
    });

    await t.test('formatTypeSchema should fail for invalid format types', () => {
        assert.ok(!formatTypeSchema.safeParse('xml').success);
        assert.ok(!formatTypeSchema.safeParse('json').success);
    });
});
