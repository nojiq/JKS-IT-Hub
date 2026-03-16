import { useState } from 'react';
import { useIsMobile } from '../../hooks';
import './FilterPanel.css';

/**
 * Collapsible filter panel component
 * Collapses on mobile, always visible on desktop
 * 
 * @param {Object} props
 * @param {Object} props.filters - Current filter values
 * @param {Function} props.onFilterChange - Callback when filters change
 * @param {Function} props.onClear - Callback to clear all filters
 * @param {React.ReactNode} props.children - Filter form controls
 */
export function FilterPanel({
    filters,
    onFilterChange,
    onClear,
    children,
    title = 'Filters',
    activeCount,
    onClearAll,
    ignoredKeys = [],
    showChips = true
}) {
    const isMobile = useIsMobile();
    const [isOpen, setIsOpen] = useState(false);
    const ignoreSet = new Set(ignoredKeys);

    const hasLegacyCount = typeof activeCount === 'number';
    const clearHandler = onClearAll || onClear;

    // Count active filters
    const activeFilterCount = hasLegacyCount
        ? activeCount
        : Object.entries(filters || {}).filter(
            ([key, value]) => !ignoreSet.has(key) && value !== '' && value !== null && value !== undefined
        ).length;

    const handleToggle = () => {
        setIsOpen(!isOpen);
    };

    const handleClear = () => {
        clearHandler?.();
        if (isMobile) {
            setIsOpen(false);
        }
    };

    // Get active filter chips
    const getFilterChips = () => {
        if (!filters || hasLegacyCount || !showChips) return [];

        return Object.entries(filters)
            .filter(([key, value]) => !ignoreSet.has(key) && value !== '' && value !== null && value !== undefined)
            .map(([key, value]) => ({
                key,
                label: formatFilterLabel(key, value)
            }));
    };

    const formatFilterLabel = (key, value) => {
        // Format the filter key to be human-readable
        const formattedKey = key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();

        return `${formattedKey}: ${value}`;
    };

    const handleRemoveFilter = (key) => {
        if (!onFilterChange) return;
        onFilterChange({ ...filters, [key]: '' });
    };

    const filterChips = getFilterChips();

    return (
        <div className="filter-panel">
            {isMobile && (
                <button
                    type="button"
                    className="filter-toggle-btn"
                    onClick={handleToggle}
                    aria-expanded={isOpen}
                    aria-controls="filter-content"
                >
                    <span className="filter-toggle-text">
                        {title}
                        {activeFilterCount > 0 && (
                            <span className="filter-badge">{activeFilterCount}</span>
                        )}
                    </span>
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`filter-toggle-icon ${isOpen ? 'open' : ''}`}
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
            )}

            <div
                id="filter-content"
                className={`filter-content ${isOpen || !isMobile ? 'open' : ''}`}
            >
                <div className="filter-controls">
                    {children}
                </div>

                {activeFilterCount > 0 && Boolean(clearHandler) && (
                    <div className="filter-actions">
                        <button
                            type="button"
                            className="filter-clear-btn"
                            onClick={handleClear}
                        >
                            Clear All Filters
                        </button>
                    </div>
                )}
            </div>

            {filterChips.length > 0 && (
                <div className="filter-chips">
                    {filterChips.map((chip) => (
                        <div key={chip.key} className="filter-chip">
                            <span className="filter-chip-label">{chip.label}</span>
                            <button
                                type="button"
                                className="filter-chip-remove"
                                onClick={() => handleRemoveFilter(chip.key)}
                                aria-label={`Remove ${chip.label} filter`}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <line x1="12" y1="4" x2="4" y2="12" />
                                    <line x1="4" y1="4" x2="12" y2="12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
