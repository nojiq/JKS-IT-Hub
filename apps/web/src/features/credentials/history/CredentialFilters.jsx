import './CredentialHistory.css';

/**
 * CredentialFilters Component
 * 
 * Filter controls for system type and date range.
 * 
 * @param {Object} props
 * @param {Object} props.filters - Current filter values
 * @param {Array} props.systems - Available system types
 * @param {Function} props.onFilterChange - Callback when filters change
 * @param {number} props.selectedCount - Number of selected versions
 * @param {Function} props.onClearSelection - Callback to clear selection
 * @param {Function} props.onCompare - Callback to initiate comparison
 * @param {boolean} props.canCompare - Whether comparison is possible
 */
function CredentialFilters({
  filters,
  systems,
  onFilterChange,
  selectedCount,
  onClearSelection,
  onCompare,
  canCompare
}) {
  const handleSystemChange = (e) => {
    onFilterChange({ system: e.target.value });
  };

  const handleStartDateChange = (e) => {
    onFilterChange({ startDate: e.target.value });
  };

  const handleEndDateChange = (e) => {
    onFilterChange({ endDate: e.target.value });
  };

  const handleClearFilters = () => {
    onFilterChange({
      system: '',
      startDate: '',
      endDate: ''
    });
  };

  const hasActiveFilters = filters.system || filters.startDate || filters.endDate;

  return (
    <div className="credential-filters">
      <div className="filter-controls">
        <div className="filter-group">
          <label htmlFor="system-filter">System</label>
          <select
            id="system-filter"
            value={filters.system}
            onChange={handleSystemChange}
            className="filter-select"
          >
            <option value="">All Systems</option>
            {systems.map((system) => (
              <option key={system} value={system}>
                {system.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="start-date">From</label>
          <input
            id="start-date"
            type="date"
            value={filters.startDate}
            onChange={handleStartDateChange}
            className="filter-input"
            max={filters.endDate || undefined}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="end-date">To</label>
          <input
            id="end-date"
            type="date"
            value={filters.endDate}
            onChange={handleEndDateChange}
            className="filter-input"
            min={filters.startDate || undefined}
          />
        </div>

        {hasActiveFilters && (
          <button
            className="btn-clear-filters"
            onClick={handleClearFilters}
            aria-label="Clear all filters"
          >
            Clear Filters
          </button>
        )}
      </div>

      {selectedCount > 0 && (
        <div className="selection-controls">
          <span className="selection-count">
            {selectedCount} {selectedCount === 1 ? 'version' : 'versions'} selected
          </span>
          <button
            className="btn-clear-selection"
            onClick={onClearSelection}
            aria-label="Clear selection"
          >
            Clear
          </button>
          <button
            className="btn-compare"
            onClick={onCompare}
            disabled={!canCompare}
            aria-label="Compare selected versions"
          >
            Compare Versions
          </button>
        </div>
      )}

      {selectedCount === 0 && (
        <div className="selection-hint">
          Select up to 2 versions to compare
        </div>
      )}
    </div>
  );
}

export default CredentialFilters;
