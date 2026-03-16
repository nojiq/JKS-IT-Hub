
import './FilterPanel.css';

export const FilterDateRange = ({
    label = "Date Range",
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange
}) => {
    return (
        <div className="filter-item">
            <span className="filter-label">{label}</span>
            <div className="date-range-container">
                <input
                    type="date"
                    className="date-input"
                    value={startDate ? startDate.split('T')[0] : ''}
                    onChange={(e) => onStartDateChange(e.target.value)}
                    placeholder="Start"
                />
                <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                <input
                    type="date"
                    className="date-input"
                    value={endDate ? endDate.split('T')[0] : ''}
                    onChange={(e) => onEndDateChange(e.target.value)}
                    placeholder="End"
                />
            </div>
        </div>
    );
};
