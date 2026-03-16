import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FilterPanel } from '../../apps/web/src/shared/ui/FilterPanel/FilterPanel';

// Mock useIsMobile hook
vi.mock('../../apps/web/src/shared/hooks', () => ({
    useIsMobile: vi.fn()
}));

import { useIsMobile } from '../../apps/web/src/shared/hooks';

describe('FilterPanel', () => {
    const mockFilters = {
        status: 'active',
        priority: 'high',
        search: 'test'
    };

    const mockOnFilterChange = vi.fn();
    const mockOnClear = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders filter toggle button on mobile', () => {
        useIsMobile.mockReturnValue(true);

        render(
            <FilterPanel
                filters={mockFilters}
                onFilterChange={mockOnFilterChange}
                onClear={mockOnClear}
            >
                <div>Filter controls</div>
            </FilterPanel>
        );

        expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('shows active filter count badge on mobile', () => {
        useIsMobile.mockReturnValue(true);

        render(
            <FilterPanel
                filters={mockFilters}
                onFilterChange={mockOnFilterChange}
                onClear={mockOnClear}
            >
                <div>Filter controls</div>
            </FilterPanel>
        );

        // Should show count of 3 active filters
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('toggles filter panel on mobile when button clicked', () => {
        useIsMobile.mockReturnValue(true);

        render(
            <FilterPanel
                filters={mockFilters}
                onFilterChange={mockOnFilterChange}
                onClear={mockOnClear}
            >
                <div>Filter controls</div>
            </FilterPanel>
        );

        const toggleButton = screen.getByRole('button', { name: /^Filters/i });

        // Initially closed
        expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

        // Click to open
        fireEvent.click(toggleButton);
        expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

        // Click to close
        fireEvent.click(toggleButton);
        expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('is always open on desktop', () => {
        useIsMobile.mockReturnValue(false);

        render(
            <FilterPanel
                filters={mockFilters}
                onFilterChange={mockOnFilterChange}
                onClear={mockOnClear}
            >
                <div>Filter controls</div>
            </FilterPanel>
        );

        // Should not render toggle button on desktop
        expect(screen.queryByRole('button', { name: /^Filters/i })).not.toBeInTheDocument();

        // Content should be visible
        expect(screen.getByText('Filter controls')).toBeInTheDocument();
    });

    it('renders filter children', () => {
        useIsMobile.mockReturnValue(false);

        render(
            <FilterPanel
                filters={mockFilters}
                onFilterChange={mockOnFilterChange}
                onClear={mockOnClear}
            >
                <input type="text" placeholder="Search..." />
                <select>
                    <option>Option 1</option>
                </select>
            </FilterPanel>
        );

        expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('shows clear button when filters are active', () => {
        useIsMobile.mockReturnValue(false);

        render(
            <FilterPanel
                filters={mockFilters}
                onFilterChange={mockOnFilterChange}
                onClear={mockOnClear}
            >
                <div>Filter controls</div>
            </FilterPanel>
        );

        expect(screen.getByText('Clear All Filters')).toBeInTheDocument();
    });

    it('calls onClear when clear button clicked', () => {
        useIsMobile.mockReturnValue(false);

        render(
            <FilterPanel
                filters={mockFilters}
                onFilterChange={mockOnFilterChange}
                onClear={mockOnClear}
            >
                <div>Filter controls</div>
            </FilterPanel>
        );

        const clearButton = screen.getByText('Clear All Filters');
        fireEvent.click(clearButton);

        expect(mockOnClear).toHaveBeenCalledTimes(1);
    });

    it('closes panel on mobile after clearing filters', () => {
        useIsMobile.mockReturnValue(true);

        render(
            <FilterPanel
                filters={mockFilters}
                onFilterChange={mockOnFilterChange}
                onClear={mockOnClear}
            >
                <div>Filter controls</div>
            </FilterPanel>
        );

        // Open panel
        const toggleButton = screen.getByRole('button', { name: /^Filters/i });
        fireEvent.click(toggleButton);
        expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

        // Clear filters
        const clearButton = screen.getByText('Clear All Filters');
        fireEvent.click(clearButton);

        // Panel should close
        expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('renders filter chips for active filters', () => {
        useIsMobile.mockReturnValue(false);

        render(
            <FilterPanel
                filters={mockFilters}
                onFilterChange={mockOnFilterChange}
                onClear={mockOnClear}
            >
                <div>Filter controls</div>
            </FilterPanel>
        );

        // Should show chips for each filter
        expect(screen.getByText(/Status: active/i)).toBeInTheDocument();
        expect(screen.getByText(/Priority: high/i)).toBeInTheDocument();
        expect(screen.getByText(/Search: test/i)).toBeInTheDocument();
    });

    it('removes individual filter when chip is clicked', () => {
        useIsMobile.mockReturnValue(false);

        render(
            <FilterPanel
                filters={mockFilters}
                onFilterChange={mockOnFilterChange}
                onClear={mockOnClear}
            >
                <div>Filter controls</div>
            </FilterPanel>
        );

        // Find and click remove button for status filter
        const removeButtons = screen.getAllByRole('button', { name: /remove/i });
        fireEvent.click(removeButtons[0]);

        expect(mockOnFilterChange).toHaveBeenCalledWith({
            ...mockFilters,
            status: ''
        });
    });

    it('does not show clear button when no filters are active', () => {
        useIsMobile.mockReturnValue(false);

        render(
            <FilterPanel
                filters={{}}
                onFilterChange={mockOnFilterChange}
                onClear={mockOnClear}
            >
                <div>Filter controls</div>
            </FilterPanel>
        );

        expect(screen.queryByText('Clear All Filters')).not.toBeInTheDocument();
    });

    it('has accessible toggle button on mobile', () => {
        useIsMobile.mockReturnValue(true);

        render(
            <FilterPanel
                filters={mockFilters}
                onFilterChange={mockOnFilterChange}
                onClear={mockOnClear}
            >
                <div>Filter controls</div>
            </FilterPanel>
        );

        const toggleButton = screen.getByRole('button', { name: /^Filters/i });
        expect(toggleButton).toHaveAttribute('aria-controls', 'filter-content');
    });
});
