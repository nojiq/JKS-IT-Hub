import { useCallback, useMemo } from "react";
import { useFilterParams } from "../hooks/useFilterParams";

const DEFAULT_IGNORED_KEYS = ["page", "perPage"];

const hasValue = (value) => value !== "" && value !== null && value !== undefined;

export function useSharedFilters(defaultFilters = {}, options = {}) {
  const ignoredKeys = options.ignoredKeys ?? DEFAULT_IGNORED_KEYS;
  const { filters, setFilter, setFilters, clearFilters } = useFilterParams(defaultFilters);

  const ignoredSet = useMemo(() => new Set(ignoredKeys), [ignoredKeys]);

  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (ignoredSet.has(key)) {
        return false;
      }

      if (!hasValue(value)) {
        return false;
      }

      const defaultValue = defaultFilters[key];
      if (!hasValue(defaultValue)) {
        return true;
      }

      return String(value) !== String(defaultValue);
    }).length;
  }, [defaultFilters, filters, ignoredSet]);

  const apply = useCallback(
    (nextFilters) => {
      setFilters(nextFilters);
    },
    [setFilters]
  );

  const reset = useCallback(() => {
    clearFilters();
  }, [clearFilters]);

  return {
    init: filters,
    filters,
    setFilter,
    setFilters,
    apply,
    reset,
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0,
    ignoredKeys
  };
}
