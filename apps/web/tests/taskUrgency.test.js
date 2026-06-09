import { describe, expect, it } from 'vitest';
import {
    URGENCY,
    classifyTaskUrgency,
    formatTaskDueLabel
} from '../src/features/maintenance/utils/taskUrgency.js';

describe('task urgency calendar buckets', () => {
    const wednesday = new Date('2026-06-10T12:00:00');

    it('marks dates before today as overdue even when status is due', () => {
        const task = {
            status: 'due',
            dueDate: '2026-06-09T23:00:00'
        };

        expect(classifyTaskUrgency(task, wednesday)).toBe(URGENCY.overdue);
        expect(formatTaskDueLabel(task, wednesday)).toBe('Overdue');
    });

    it('uses Monday through Sunday for due this week', () => {
        expect(classifyTaskUrgency({
            status: 'scheduled',
            dueDate: '2026-06-14T09:00:00'
        }, wednesday)).toBe(URGENCY.dueThisWeek);

        expect(classifyTaskUrgency({
            status: 'scheduled',
            dueDate: '2026-06-15T09:00:00'
        }, wednesday)).toBe(URGENCY.upcoming);
    });

    it('keeps Sunday due dates in this week and next Monday in upcoming', () => {
        const sunday = new Date('2026-06-14T10:00:00');

        expect(classifyTaskUrgency({
            status: 'scheduled',
            dueDate: '2026-06-14T18:00:00'
        }, sunday)).toBe(URGENCY.dueThisWeek);

        expect(classifyTaskUrgency({
            status: 'scheduled',
            dueDate: '2026-06-15T09:00:00'
        }, sunday)).toBe(URGENCY.upcoming);
    });
});
