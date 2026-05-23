import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { filterComboboxOptions } from "../utils/ipListDisplay.js";

export function SubnetFilterCombobox({
  comboboxOptions,
  selection = { kind: "all", value: "" },
  onSelect,
  isLoading = false,
  label = "Subnet",
  placeholder = "All subnets"
}) {
  const listboxId = useId();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const filtered = useMemo(
    () => filterComboboxOptions(comboboxOptions, query),
    [comboboxOptions, query]
  );

  const flatOptions = useMemo(() => {
    const items = [];
    if (filtered.allOption) items.push(filtered.allOption);
    for (const section of filtered.sections) {
      items.push(...section.options);
    }
    return items;
  }, [filtered]);

  const selectedLabel = useMemo(() => {
    if (selection.kind === "all" || !selection.value) return "";
    for (const section of comboboxOptions.sections) {
      const found = section.options.find(
        (option) => option.kind === selection.kind && option.value === selection.value
      );
      if (found) return found.sublabel ? `${found.label} · ${found.sublabel}` : found.label;
    }
    if (selection.kind === "prefix") return `${selection.value}.x`;
    return "";
  }, [comboboxOptions, selection]);

  const displayValue = isOpen ? query : selectedLabel;

  const handleSelect = (option) => {
    onSelect?.(option);
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    handleSelect(comboboxOptions.allOption);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => Math.min(prev + 1, flatOptions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      if (isOpen && activeIndex >= 0 && flatOptions[activeIndex]) {
        event.preventDefault();
        handleSelect(flatOptions[activeIndex]);
      }
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      setQuery("");
    }
  };

  useEffect(() => {
    if (!isOpen) setActiveIndex(-1);
  }, [isOpen, query]);

  const showDropdown = isOpen && (flatOptions.length > 0 || query.length > 0);
  let optionOffset = 0;

  const renderOption = (option) => {
    const index = optionOffset;
    optionOffset += 1;
    const optionId = `${listboxId}-option-${index}`;
    const isActive = index === activeIndex;

    return (
      <li
        key={option.id}
        id={optionId}
        role="option"
        aria-selected={isActive}
        className={`ip-list-subnet-combobox__option${isActive ? " is-active" : ""}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => handleSelect(option)}
      >
        <span className="ip-list-subnet-combobox__option-copy">
          <span className="ip-list-subnet-combobox__option-label">{option.label}</span>
          {option.sublabel ? (
            <span className="ip-list-subnet-combobox__option-sublabel">{option.sublabel}</span>
          ) : null}
        </span>
        <span className="ip-list-subnet-combobox__option-count">
          {isLoading ? "…" : option.count}
        </span>
      </li>
    );
  };

  return (
    <div className="ip-list-subnet-combobox">
      <label className="ip-list-subnet-combobox__label" htmlFor={listboxId}>
        {label}
      </label>
      <div className="ip-list-subnet-combobox__control">
        <input
          ref={inputRef}
          id={listboxId}
          type="search"
          className="ip-list-subnet-combobox__input"
          value={displayValue}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setIsOpen(false);
              setQuery("");
            }, 150);
          }}
          placeholder={placeholder}
          aria-expanded={showDropdown}
          aria-controls={`${listboxId}-listbox`}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          role="combobox"
        />
        {selection.kind !== "all" && selection.value ? (
          <button
            type="button"
            className="ip-list-subnet-combobox__clear"
            onClick={handleClear}
            aria-label="Clear subnet filter"
          >
            ×
          </button>
        ) : null}
      </div>

      {showDropdown ? (
        <ul
          id={`${listboxId}-listbox`}
          className="ip-list-subnet-combobox__listbox"
          role="listbox"
          aria-label="Subnet filter options"
        >
          {filtered.allOption ? (
            <li className="ip-list-subnet-combobox__group" role="presentation">
              <ul role="group" aria-label="All">
                {renderOption(filtered.allOption)}
              </ul>
            </li>
          ) : null}
          {filtered.sections.map((section) => (
            <li key={section.id} className="ip-list-subnet-combobox__group" role="presentation">
              <span className="ip-list-subnet-combobox__group-label">{section.label}</span>
              <ul role="group" aria-label={section.label}>
                {section.options.map((option) => renderOption(option))}
              </ul>
            </li>
          ))}
          {flatOptions.length === 0 ? (
            <li className="ip-list-subnet-combobox__empty" role="presentation">
              No subnets match this search.
            </li>
          ) : null}
          <li className="ip-list-subnet-combobox__footer" role="presentation">
            <Link className="ip-list-subnet-combobox__manage" to="/ip-list/subnets">
              Manage subnets
            </Link>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
