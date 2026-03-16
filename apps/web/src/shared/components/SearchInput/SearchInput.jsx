
import { useState, useEffect, useRef } from 'react';
import './SearchInput.css';

export const SearchInput = ({
    value = '',
    onChange,
    onClear,
    placeholder = 'Search...',
    debounceMs = 300,
    isLoading = false
}) => {
    const [localValue, setLocalValue] = useState(value);
    const debounceRef = useRef(null);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleChange = (e) => {
        const newValue = e.target.value;
        setLocalValue(newValue);

        // Clear previous debounce
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Set new debounce
        debounceRef.current = setTimeout(() => {
            onChange?.(newValue);
        }, debounceMs);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            // Immediately trigger on Enter
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            onChange?.(localValue);
        }
    };

    const handleClear = () => {
        setLocalValue('');
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        onChange?.('');
        onClear?.();
    };

    return (
        <div className="search-input-container">
            <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
                type="text"
                className="search-input"
                value={localValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                aria-label={placeholder}
            />

            {localValue && (
                <button
                    type="button"
                    className="search-clear-btn"
                    onClick={handleClear}
                    aria-label="Clear search"
                >
                    &times;
                </button>
            )}

            {isLoading && (
                <div className="search-loading-spinner" aria-label="Loading">
                    <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            )}
        </div>
    );
};
