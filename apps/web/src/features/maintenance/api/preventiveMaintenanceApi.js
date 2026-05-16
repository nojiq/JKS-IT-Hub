import { apiFetch } from '../../../shared/utils/api-client.js';

const MAINTENANCE_BASE = '/api/v1/maintenance';

const createApiError = (payload = {}) => {
    const error = new Error(payload?.detail ?? 'Request failed.');
    error.problem = payload;
    error.status = payload?.status;
    return error;
};

const parseJson = async (response) => {
    let payload;
    try {
        payload = await response.json();
    } catch {
        payload = {};
    }
    if (!response.ok) throw createApiError(payload);
    return payload;
};

export const fetchMaintenanceProfiles = async (includeInactive = false) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/profiles?includeInactive=${includeInactive}`);
    const payload = await parseJson(response);
    return payload.data ?? [];
};

export const createMaintenanceProfile = async (data) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/profiles`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
    const payload = await parseJson(response);
    return payload.data;
};

export const updateMaintenanceProfile = async (id, data) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/profiles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    });
    const payload = await parseJson(response);
    return payload.data;
};

export const saveProfileChecklist = async (profileId, items) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/profiles/${profileId}/checklist`, {
        method: 'PUT',
        body: JSON.stringify({ items })
    });
    const payload = await parseJson(response);
    return payload.data;
};

export const fetchAssignmentMatrix = async () => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/assignments/matrix`);
    const payload = await parseJson(response);
    return payload.data ?? [];
};

export const createMaintenanceAssignment = async (data) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/assignments`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
    const payload = await parseJson(response);
    return payload.data;
};

export const fetchMyMaintenanceRuns = async (filters = {}) => {
    const query = new URLSearchParams();
    if (filters.page) query.append('page', String(filters.page));
    if (filters.perPage) query.append('perPage', String(filters.perPage));

    const qs = query.toString();
    const response = await apiFetch(`${MAINTENANCE_BASE}/runs/my${qs ? `?${qs}` : ''}`);
    return parseJson(response);
};

export const fetchMaintenanceRunHistory = async (filters = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
            query.append(key, String(value));
        }
    }
    const qs = query.toString();
    const response = await apiFetch(`${MAINTENANCE_BASE}/runs/history${qs ? `?${qs}` : ''}`);
    return parseJson(response);
};

export const fetchMaintenanceRun = async (runId) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/runs/${runId}`);
    const payload = await parseJson(response);
    return payload.data;
};

export const startMaintenanceRun = async (runId) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/runs/${runId}/start`, { method: 'POST' });
    const payload = await parseJson(response);
    return payload.data;
};

export const updateMaintenanceRunItem = async (itemId, data) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/runs/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    });
    const payload = await parseJson(response);
    return payload.data;
};

export const completeMaintenanceRun = async (runId) => {
    const response = await apiFetch(`${MAINTENANCE_BASE}/runs/${runId}/complete`, { method: 'POST' });
    const payload = await parseJson(response);
    return payload.data;
};
