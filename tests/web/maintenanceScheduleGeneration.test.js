import { describe, it, expect } from 'vitest';
import {
    filterCyclesForGeneration,
    MIN_MONTHS_AHEAD,
    MAX_MONTHS_AHEAD
} from '../../apps/web/src/features/maintenance/utils/scheduleGeneration.js';

const cycles = [
    { id: 'cycle-a', name: 'Quarterly Servers' },
    { id: 'cycle-b', name: 'Laptop Refresh' },
    { id: 'cycle-c', name: 'Desktop Rotation' }
];

describe('scheduleGeneration utils', () => {
    it('exports expected generation bounds', () => {
        expect(MIN_MONTHS_AHEAD).toBe(12);
        expect(MAX_MONTHS_AHEAD).toBe(24);
    });

    it('returns all cycles when no filter is provided', () => {
        expect(filterCyclesForGeneration(cycles, {})).toEqual(cycles);
    });

    it('filters by selected cycle id', () => {
        const result = filterCyclesForGeneration(cycles, { cycleId: 'cycle-b' });
        expect(result).toEqual([{ id: 'cycle-b', name: 'Laptop Refresh' }]);
    });

    it('filters by search text case-insensitively', () => {
        const result = filterCyclesForGeneration(cycles, { search: 'desktop' });
        expect(result).toEqual([{ id: 'cycle-c', name: 'Desktop Rotation' }]);
    });

    it('applies cycle and search together', () => {
        const result = filterCyclesForGeneration(cycles, {
            cycleId: 'cycle-a',
            search: 'laptop'
        });
        expect(result).toEqual([]);
    });
});
