const UUID_PATTERN = /\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TECH_PREFIX_PATTERN = /^tech-/i;

export const splitLabelAndUuid = (name) => {
    const raw = String(name || '').trim();
    if (!raw) {
        return { primary: '', secondaryId: '' };
    }

    const match = raw.match(UUID_PATTERN);
    if (!match) {
        return { primary: raw, secondaryId: '' };
    }

    const secondaryId = match[0].trim();
    const primary = raw.slice(0, match.index).trim();
    return {
        primary: primary || raw,
        secondaryId
    };
};

export const shortId = (id, visibleChars = 6) => {
    const value = String(id || '').trim();
    if (!value) return '';
    if (value.length <= visibleChars + 3) return value;
    return `…${value.slice(-visibleChars)}`;
};

export const formatAssignee = (user) => {
    if (!user) {
        return { primary: 'Unassigned', secondary: '' };
    }

    const displayName = user.displayName?.trim();
    const username = user.username?.trim();
    let primary = displayName || username || 'Unknown';

    if (TECH_PREFIX_PATTERN.test(primary) && username && username !== primary) {
        return { primary: username, secondary: shortId(user.id) };
    }

    if (UUID_PATTERN.test(` ${primary}`) || /^[0-9a-f-]{36}$/i.test(primary)) {
        return { primary: username || 'Technician', secondary: shortId(user.id || primary) };
    }

    return { primary, secondary: '' };
};

export const formatPolicyLabel = (name, fallback = 'Ad-hoc') => {
    return formatCycleLabel(name, fallback);
};

export const formatCycleLabel = (name, fallback = 'Ad-hoc') => {
    const { primary, secondaryId } = splitLabelAndUuid(name);
    return {
        primary: primary || fallback,
        secondary: secondaryId ? shortId(secondaryId) : ''
    };
};

export const formatTechnician = formatAssignee;

export const formatTaskTitle = (window, fallback = 'Ad-hoc') => {
    return formatWindowTitle(window, fallback);
};

export const formatWindowTitle = (window, fallback = 'Ad-hoc') => {
    const cycleName = window?.cycleConfig?.name;
    const { primary, secondary } = formatCycleLabel(cycleName, fallback);
    const windowId = window?.id ? shortId(window.id) : '';

    return {
        primary,
        secondary: secondary || windowId
    };
};

export const buildMaintenanceSuggestions = ({ cycles = [], windows = [], query = '' }) => {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    const matchesQuery = (parts) => {
        if (!normalizedQuery) return true;
        return parts.some((part) => String(part || '').toLowerCase().includes(normalizedQuery));
    };

    const cycleSuggestions = cycles
        .filter((cycle) => matchesQuery([cycle.name, cycle.description, cycle.id]))
        .slice(0, 8)
        .map((cycle) => {
            const { primary, secondary } = formatCycleLabel(cycle.name, 'Cycle');
            return {
                type: 'cycle',
                id: cycle.id,
                label: primary,
                meta: secondary,
                raw: cycle
            };
        });

    const windowSuggestions = windows
        .filter((window) => {
            const title = formatWindowTitle(window);
            return matchesQuery([
                title.primary,
                title.secondary,
                window.id,
                window.cycleConfig?.name,
                window.status,
                window.assignedTo?.displayName,
                window.assignedTo?.username
            ]);
        })
        .slice(0, 10)
        .map((window) => {
            const title = formatWindowTitle(window);
            return {
                type: 'window',
                id: window.id,
                label: title.primary,
                meta: title.secondary,
                status: window.status,
                raw: window
            };
        });

    return { cycleSuggestions, windowSuggestions };
};
