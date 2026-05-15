import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { buildMaintenanceSuggestions } from '../utils/maintenanceDisplay.js';
import { formatDisplayDateTime } from '../../../shared/utils/date-format.js';
import './MaintenanceSearchCombobox.css';

const DEBOUNCE_MS = 300;

export function MaintenanceSearchCombobox({
    value = '',
    onChange,
    onSelect,
    cycles = [],
    windows = [],
    placeholder = 'Search cycles or windows…',
    isLoading = false,
    debounceMs = DEBOUNCE_MS
}) {
    const listboxId = useId();
    const inputRef = useRef(null);
    const debounceRef = useRef(null);
    const [localValue, setLocalValue] = useState(value);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const { cycleSuggestions, windowSuggestions } = useMemo(
        () => buildMaintenanceSuggestions({ cycles, windows, query: localValue }),
        [cycles, windows, localValue]
    );

    const flatSuggestions = useMemo(
        () => [...cycleSuggestions, ...windowSuggestions],
        [cycleSuggestions, windowSuggestions]
    );

    const emitChange = useCallback((nextValue) => {
        onChange?.(nextValue);
    }, [onChange]);

    const handleInputChange = (event) => {
        const nextValue = event.target.value;
        setLocalValue(nextValue);
        setIsOpen(true);
        setActiveIndex(-1);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            emitChange(nextValue);
        }, debounceMs);
    };

    const handleSelect = (suggestion) => {
        setLocalValue(suggestion.label);
        emitChange(suggestion.label);
        onSelect?.(suggestion);
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.focus();
    };

    const handleClear = () => {
        setLocalValue('');
        emitChange('');
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.focus();
    };

    const handleKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((prev) => Math.min(prev + 1, flatSuggestions.length - 1));
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((prev) => Math.max(prev - 1, 0));
            return;
        }

        if (event.key === 'Enter') {
            if (isOpen && activeIndex >= 0 && flatSuggestions[activeIndex]) {
                event.preventDefault();
                handleSelect(flatSuggestions[activeIndex]);
                return;
            }

            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            emitChange(localValue);
            setIsOpen(false);
            return;
        }

        if (event.key === 'Escape') {
            setIsOpen(false);
            setActiveIndex(-1);
        }
    };

    useEffect(() => () => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
    }, []);

    const showDropdown = isOpen && (flatSuggestions.length > 0 || localValue.length > 0);
    let optionOffset = 0;

    const renderSuggestion = (suggestion, index) => {
        const optionId = `${listboxId}-option-${index}`;
        const isActive = index === activeIndex;

        return (
            <li
                key={`${suggestion.type}-${suggestion.id}`}
                id={optionId}
                role="option"
                aria-selected={isActive}
                className={`maintenance-search-combobox__option${isActive ? ' is-active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(suggestion)}
            >
                <span className="maintenance-search-combobox__option-label">{suggestion.label}</span>
                <span className="maintenance-search-combobox__option-meta">
                    {suggestion.type === 'window' && suggestion.raw?.scheduledStartDate
                        ? formatDisplayDateTime(suggestion.raw.scheduledStartDate, { fallback: '' })
                        : null}
                    {suggestion.meta ? (
                        <code className="maintenance-search-combobox__option-id">{suggestion.meta}</code>
                    ) : null}
                    {suggestion.status ? (
                        <span className="maintenance-search-combobox__option-status">{suggestion.status}</span>
                    ) : null}
                </span>
            </li>
        );
    };

    return (
        <div className="maintenance-search-combobox">
            <div className="maintenance-search-combobox__control">
                <svg className="maintenance-search-combobox__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                        fillRule="evenodd"
                        d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                        clipRule="evenodd"
                    />
                </svg>
                <input
                    ref={inputRef}
                    type="search"
                    className="maintenance-search-combobox__input"
                    value={localValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => {
                        window.setTimeout(() => setIsOpen(false), 150);
                    }}
                    placeholder={placeholder}
                    aria-label={placeholder}
                    aria-expanded={showDropdown}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    aria-activedescendant={
                        activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
                    }
                    role="combobox"
                />
                {localValue ? (
                    <button
                        type="button"
                        className="maintenance-search-combobox__clear"
                        onClick={handleClear}
                        aria-label="Clear search"
                    >
                        ×
                    </button>
                ) : null}
                {isLoading ? (
                    <span className="maintenance-search-combobox__spinner" aria-label="Loading" />
                ) : null}
            </div>

            {showDropdown ? (
                <ul id={listboxId} className="maintenance-search-combobox__listbox" role="listbox">
                    {cycleSuggestions.length > 0 ? (
                        <li className="maintenance-search-combobox__group" role="presentation">
                            <span className="maintenance-search-combobox__group-label">Cycles</span>
                            <ul role="group">
                                {cycleSuggestions.map((suggestion) => {
                                    const index = optionOffset;
                                    optionOffset += 1;
                                    return renderSuggestion(suggestion, index);
                                })}
                            </ul>
                        </li>
                    ) : null}
                    {windowSuggestions.length > 0 ? (
                        <li className="maintenance-search-combobox__group" role="presentation">
                            <span className="maintenance-search-combobox__group-label">Windows</span>
                            <ul role="group">
                                {windowSuggestions.map((suggestion) => {
                                    const index = optionOffset;
                                    optionOffset += 1;
                                    return renderSuggestion(suggestion, index);
                                })}
                            </ul>
                        </li>
                    ) : null}
                    {flatSuggestions.length === 0 ? (
                        <li className="maintenance-search-combobox__empty" role="presentation">
                            No matches for this search.
                        </li>
                    ) : null}
                </ul>
            ) : null}
        </div>
    );
}
