
import { useSearchParams } from 'react-router-dom';
import { useMemo, useCallback } from 'react';

/**
 * Hook to manage filter state via URL query parameters.
 * 
 * @param {Object} defaultFilters - Default filter values
 * @returns {Object} - { filters, setFilter, setFilters, clearFilters }
 */
export const useFilterParams = (defaultFilters = {}) => {
    const [searchParams, setSearchParams] = useSearchParams();

    // Parse current filters from URL
    const filters = useMemo(() => {
        const result = { ...defaultFilters };

        for (const [key, value] of searchParams.entries()) {
            if (value && value !== 'undefined' && value !== 'null') {
                result[key] = value;
            }
        }

        return result;
    }, [searchParams, defaultFilters]);

    // Update a single filter
    const setFilter = useCallback((key, value) => {
        const next = new URLSearchParams(searchParams);

        if (value === undefined || value === null || value === '') {
            next.delete(key);
        } else {
            next.set(key, value);
        }

        // Reset page on filter change
        if (key !== 'page' && next.has('page')) {
            next.set('page', '1');
        }

        setSearchParams(next);
    }, [searchParams, setSearchParams]);

    // Update multiple filters at once
    const setFilters = useCallback((newFilters) => {
        const next = new URLSearchParams(searchParams);

        let hasChanges = false;
        for (const [key, value] of Object.entries(newFilters)) {
            if (value === undefined || value === null || value === '') {
                if (next.has(key)) {
                    next.delete(key);
                    hasChanges = true;
                }
            } else {
                if (next.get(key) !== String(value)) {
                    next.set(key, value);
                    hasChanges = true;
                }
            }
        }

        if (hasChanges && !newFilters.hasOwnProperty('page') && next.has('page')) {
            next.set('page', '1');
        }

        setSearchParams(next);
    }, [searchParams, setSearchParams]);

    // Clear all filters
    const clearFilters = useCallback(() => {
        setSearchParams({});
    }, [setSearchParams]);

    return {
        filters,
        setFilter,
        setFilters,
        clearFilters
    };
};
