import { apiFetch } from "../../../shared/utils/api-client.js";

const MAINTENANCE_BASE = "/api/v1/maintenance";
export const MAINTENANCE_CONFIG_REQUIRED_FIELDS = Object.freeze([
    'id',
    'name',
    'description',
    'intervalMonths',
    'isActive',
    'defaultChecklistTemplateId',
    'defaultChecklist',
    'createdAt',
    'updatedAt'
]);

const createApiError = (payload = {}) => {
    const error = new Error(payload?.detail ?? "Request failed.");
    error.problem = payload;
    error.type = payload?.type;
    error.status = payload?.status;
    return error;
};

const parsePayload = async (response) => {
    let payload;
    try {
        payload = await response.json();
    } catch {
        payload = {};
    }

    if (!response.ok) {
        throw createApiError(payload);
    }
    return payload?.data ?? null;
};

const normalizeChecklistSummary = (checklist) => {
    if (!checklist) return null;

    const itemCount = typeof checklist.itemCount === "number"
        ? checklist.itemCount
        : checklist._count?.items ?? 0;

    return {
        id: checklist.id ?? null,
        name: checklist.name ?? null,
        version: checklist.version ?? null,
        itemCount
    };
};

export const normalizeCycleConfig = (cycle) => {
    if (!cycle) return null;

    return {
        id: cycle.id ?? null,
        name: cycle.name ?? '',
        description: cycle.description ?? null,
        intervalMonths: cycle.intervalMonths ?? 0,
        isActive: Boolean(cycle.isActive),
        defaultChecklistTemplateId: cycle.defaultChecklistTemplateId ?? null,
        defaultChecklist: normalizeChecklistSummary(cycle.defaultChecklist),
        createdAt: cycle.createdAt ?? null,
        updatedAt: cycle.updatedAt ?? null
    };
};

const normalizeCycleConfigList = (cycles) => {
    if (!Array.isArray(cycles)) return [];
    return cycles.map(normalizeCycleConfig);
};

// Cycles
export const fetchCycles = async (includeInactive = false) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/cycles?includeInactive=${includeInactive}`);
    const data = await parsePayload(response);
    return normalizeCycleConfigList(data);
};

export const fetchCycle = async (id) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/cycles/${id}`);
    const data = await parsePayload(response);
    return normalizeCycleConfig(data);
};

export const createCycle = async (data) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/cycles`, {
        method: "POST",
        body: JSON.stringify(data)
    });
    const payload = await parsePayload(response);
    return normalizeCycleConfig(payload);
};

export const updateCycle = async (id, data) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/cycles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data)
    });
    const payload = await parsePayload(response);
    return normalizeCycleConfig(payload);
};

export const deleteCycle = async (id) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/cycles/${id}`, {
        method: "DELETE"
    });
    const payload = await parsePayload(response);
    return normalizeCycleConfig(payload);
};

export const fetchChecklistTemplates = async (includeInactive = false) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/checklists?includeInactive=${includeInactive}`);
    return parsePayload(response);
};

export const fetchChecklistTemplate = async (id) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/checklists/${id}`);
    return parsePayload(response);
};

export const createChecklistTemplate = async (data) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/checklists`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
    return parsePayload(response);
};

export const updateChecklistTemplate = async (id, data) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/checklists/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    });
    return parsePayload(response);
};

export const deactivateChecklistTemplate = async (id) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/checklists/${id}`, {
        method: 'DELETE'
    });
    return parsePayload(response);
};

// Windows
export const fetchWindows = async (filters = {}) => {
    const query = new URLSearchParams();
    if (filters.cycleId) query.append('cycleId', filters.cycleId);
    if (filters.status) {
        if (Array.isArray(filters.status)) {
            filters.status.forEach(s => query.append('status', s));
        } else {
            query.append('status', filters.status);
        }
    }
    if (filters.startDateFrom) query.append('startDateFrom', filters.startDateFrom);
    if (filters.startDateTo) query.append('startDateTo', filters.startDateTo);
    if (filters.page) query.append('page', filters.page);
    if (filters.perPage) query.append('perPage', filters.perPage);
    if (filters.deviceType) query.append('deviceType', filters.deviceType);
    if (filters.search) query.append('search', filters.search);
    if (filters.assignedTo) query.append('assignedTo', filters.assignedTo);

    const response = await apiFetch(`${MAINTENANCE_BASE}/windows?${query.toString()}`);

    let payload;
    try {
        payload = await response.json();
    } catch {
        payload = {};
    }

    if (!response.ok) {
        throw createApiError(payload);
    }
    return payload; // Returns { data, meta }
};

export const fetchWindow = async (id) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/windows/${id}`);
    return parsePayload(response);
};

export const createWindow = async (data) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/windows`, {
        method: "POST",
        body: JSON.stringify(data)
    });
    return parsePayload(response);
};

export const updateWindow = async (id, data) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/windows/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data)
    });
    return parsePayload(response);
};

export const cancelWindow = async (id, reason) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/windows/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason })
    });
    return parsePayload(response);
};

// Schedule
export const generateSchedule = async (cycleId, options) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/cycles/${cycleId}/generate-schedule`, {
        method: "POST",
        body: JSON.stringify(options ?? {})
    });
    return parsePayload(response);
};

// Maintenance Completion
export const signOffWindow = async (windowId, data = {}) => {
    const payload = {
        completedItems: data.completedItems,
        notes: data.notes
    };

    if (data.assistedSigner) {
        payload.assistedSigner = data.assistedSigner;
    }

    const response = await apiFetch(`${MAINTENANCE_BASE}/windows/${windowId}/sign-off`, {
        method: "POST",
        body: JSON.stringify(payload)
    });
    return parsePayload(response);
};

export const fetchCompletionDetails = async (windowId) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/windows/${windowId}/completion`);
    return parsePayload(response);
};

export const fetchSignOffEligibility = async (windowId) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/windows/${windowId}/sign-off-eligibility`);
    return parsePayload(response);
};

export const fetchCompletionHistory = async (filters = {}) => {
    const query = new URLSearchParams();
    if (filters.page) query.append('page', filters.page);
    if (filters.perPage) query.append('perPage', filters.perPage);
    if (filters.startDate) query.append('startDate', filters.startDate);
    if (filters.endDate) query.append('endDate', filters.endDate);
    if (filters.deviceType) query.append('deviceType', filters.deviceType);

    const response = await apiFetch(`${MAINTENANCE_BASE}/completions/my-history?${query.toString()}`);

    let payload;
    try {
        payload = await response.json();
    } catch {
        payload = {};
    }

    if (!response.ok) {
        throw createApiError(payload);
    }
    return payload; // Returns { data, meta }
};

// Assignment Rules
export const fetchAssignmentRules = async (includeInactive = false) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/assignment-rules?includeInactive=${includeInactive}`);
    return parsePayload(response);
};

export const fetchAssignmentRule = async (id) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/assignment-rules/${id}`);
    return parsePayload(response);
};

export const createAssignmentRule = async (data) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/assignment-rules`, {
        method: "POST",
        body: JSON.stringify(data)
    });
    return parsePayload(response);
};

export const updateAssignmentRule = async (id, data) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/assignment-rules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data)
    });
    return parsePayload(response);
};

export const deactivateAssignmentRule = async (id) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/assignment-rules/${id}`, {
        method: "DELETE"
    });
    return parsePayload(response);
};

export const resetRotation = async (id) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/assignment-rules/${id}/reset-rotation`, {
        method: "POST"
    });
    return parsePayload(response);
};

export const manuallyAssignWindow = async (windowId, userId) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/windows/${windowId}/assign`, {
        method: "POST",
        body: JSON.stringify({ userId })
    });
    return parsePayload(response);
};

export const fetchMyMaintenanceWindows = async (filters = {}) => {
    const query = new URLSearchParams();
    if (filters.status) query.append('status', filters.status);
    if (filters.page) query.append('page', String(filters.page));
    if (filters.limit) query.append('limit', String(filters.limit));

    const queryString = query.toString();
    const response = await apiFetch(`${MAINTENANCE_BASE}/my-tasks${queryString ? `?${queryString}` : ''}`);

    let payload;
    try {
        payload = await response.json();
    } catch {
        payload = {};
    }

    if (!response.ok) {
        throw createApiError(payload);
    }

    return payload; // Returns { data, meta }
};
