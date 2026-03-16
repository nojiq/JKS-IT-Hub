
import './FilterPanel.css';

export const FilterSelect = ({ label, value, onChange, options, placeholder = 'All' }) => {
    return (
        <div className="filter-item">
            <label className="filter-label">{label}</label>
            <select
                className="filter-select"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">{placeholder}</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
};
