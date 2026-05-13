import { describe, expect, it } from 'vitest';
import { formatDisplayDate, formatDisplayDateTime } from '../src/shared/utils/date-format.js';

describe('date display formatting', () => {
  it('formats ISO timestamps as dd/mm/yyyy', () => {
    expect(formatDisplayDate('2026-04-16T01:02:03.000Z')).toBe('16/04/2026');
  });

  it('formats date-only values as dd/mm/yyyy without timezone shifting', () => {
    expect(formatDisplayDate('1998-01-02')).toBe('02/01/1998');
  });

  it('formats date-time values with dd/mm/yyyy first', () => {
    expect(formatDisplayDateTime('2026-04-16T01:02:03.000Z')).toMatch(/^16\/04\/2026, \d{2}:\d{2}$/);
  });

  it('uses the provided fallback for missing or invalid values', () => {
    expect(formatDisplayDate(null, { fallback: '-' })).toBe('-');
    expect(formatDisplayDateTime('not-a-date', { fallback: 'N/A' })).toBe('N/A');
  });
});
