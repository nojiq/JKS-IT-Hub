import { describe, expect, it } from 'vitest';
import {
    buildMaintenanceSuggestions,
    formatAssignee,
    formatCycleLabel,
    formatWindowTitle,
    splitLabelAndUuid
} from '../src/features/maintenance/utils/maintenanceDisplay.js';

describe('maintenanceDisplay', () => {
    it('splits trailing uuid from cycle names', () => {
        const result = splitLabelAndUuid('Test Cycle 497ef5f7-6fe9-4805-a589-bb4bdcc95c35');
        expect(result.primary).toBe('Test Cycle');
        expect(result.secondaryId).toBe('497ef5f7-6fe9-4805-a589-bb4bdcc95c35');
    });

    it('formats assignee without exposing tech uuid prefix as primary label', () => {
        const result = formatAssignee({
            id: '378dd208-41ba-419e-a121-a99849f595bb',
            username: 'tech.user',
            displayName: 'tech-378dd208-41ba-419e-a121-a99849f595bb'
        });
        expect(result.primary).toBe('tech.user');
        expect(result.secondary).toContain('595bb');
    });

    it('builds grouped combobox suggestions from cycles and windows', () => {
        const { cycleSuggestions, windowSuggestions } = buildMaintenanceSuggestions({
            cycles: [{ id: 'c1', name: 'Quarterly PM' }],
            windows: [{
                id: 'w1',
                status: 'OVERDUE',
                scheduledStartDate: '2026-05-11T14:45:00.000Z',
                cycleConfig: { name: 'Quarterly PM' }
            }],
            query: 'quarter'
        });

        expect(cycleSuggestions).toHaveLength(1);
        expect(windowSuggestions).toHaveLength(1);
        expect(formatCycleLabel('Quarterly PM').primary).toBe('Quarterly PM');
        expect(formatWindowTitle({ id: 'w1', cycleConfig: { name: 'Quarterly PM' } }).primary).toBe('Quarterly PM');
    });
});
