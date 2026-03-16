import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useSharedFilters } from '../src/shared/workspace/useSharedFilters';

const withRouter = (initialEntry) => ({ children }) => (
    <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
);

describe('useSharedFilters', () => {
    it('supports init/apply/reset and active-state calculations', () => {
        const { result } = renderHook(
            () => useSharedFilters({ status: 'SUBMITTED', page: '1', perPage: '20' }),
            { wrapper: withRouter('/?page=3') }
        );

        expect(result.current.init.status).toBe('SUBMITTED');
        expect(result.current.hasActiveFilters).toBe(false);

        act(() => {
            result.current.apply({ priority: 'HIGH' });
        });

        expect(result.current.filters.priority).toBe('HIGH');
        expect(result.current.filters.page).toBe('1');
        expect(result.current.activeFilterCount).toBe(1);
        expect(result.current.hasActiveFilters).toBe(true);

        act(() => {
            result.current.reset();
        });

        expect(result.current.filters.status).toBe('SUBMITTED');
        expect(result.current.filters.priority).toBeUndefined();
        expect(result.current.activeFilterCount).toBe(0);
        expect(result.current.hasActiveFilters).toBe(false);
    });
});
