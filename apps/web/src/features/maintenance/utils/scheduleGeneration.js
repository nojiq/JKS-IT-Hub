export const MIN_MONTHS_AHEAD = 12;
export const MAX_MONTHS_AHEAD = 24;

export const filterCyclesForGeneration = (cycles = [], filters = {}) => {
    const cycleId = typeof filters.cycleId === 'string' ? filters.cycleId : '';
    const search = typeof filters.search === 'string' ? filters.search.trim().toLowerCase() : '';

    return cycles.filter((cycle) => {
        if (cycleId && cycle.id !== cycleId) {
            return false;
        }

        if (search && !String(cycle.name || '').toLowerCase().includes(search)) {
            return false;
        }

        return true;
    });
};
