const API_BASE = '/api/v1';
const CREDENTIALS_BASE = '/api/v1/credentials';

const buildQueryString = (params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        search.append(key, String(value));
    });
    const queryString = search.toString();
    return queryString ? `?${queryString}` : '';
};

const handleResponse = async (response) => {
    const data = await response.json();
    
    if (!response.ok) {
        const error = new Error(data.detail || 'Request failed');
        error.status = response.status;
        error.problemDetails = data;
        throw error;
    }
    
    return data;
};

const toIsoDateTimeFilter = (value, endOfDay = false) => {
    if (!value) return value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
        return `${value}${suffix}`;
    }
    return value;
};

export const generateCredentials = async (userId, systemId = undefined) => {
    const response = await fetch(`${API_BASE}/credential-templates/users/${userId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(systemId ? { systemId } : {})
    });
    return handleResponse(response);
};

export const previewCredentials = async (userId, systemId = undefined) => {
    const response = await fetch(`${API_BASE}/credential-templates/users/${userId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(systemId ? { systemId } : {})
    });
    return handleResponse(response);
};

export const getUserCredentials = async (userId) => {
    const response = await fetch(`${API_BASE}/credential-templates/users/${userId}`, {
        credentials: 'include'
    });
    return handleResponse(response);
};

export const getCredentialDetail = async (credentialId) => {
    const response = await fetch(`${API_BASE}/credential-templates/detail/${credentialId}`, {
        credentials: 'include'
    });
    return handleResponse(response);
};

export const getCredentialVersions = async (credentialId) => {
    const response = await fetch(`${API_BASE}/credential-templates/detail/${credentialId}/versions`, {
        credentials: 'include'
    });
    return handleResponse(response);
};

export const confirmCredentials = async (userId, { previewToken, confirmed }) => {
    const response = await fetch(`${API_BASE}/credential-templates/users/${userId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ previewToken, confirmed })
    });
    return handleResponse(response);
};

// Credential Regeneration API (Story 2.4)

export const initiateRegeneration = async (userId, systemId = undefined) => {
    const response = await fetch(`${API_BASE}/credential-templates/users/${userId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(systemId ? { systemId } : {})
    });
    return handleResponse(response);
};

export const previewRegeneration = async (userId) => {
    const response = await fetch(`${API_BASE}/credential-templates/users/${userId}/regenerate/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    });
    return handleResponse(response);
};

export const confirmRegeneration = async (userId, { previewToken, confirmed, acknowledgedWarnings, skipLocked, force }) => {
    const response = await fetch(`${API_BASE}/credential-templates/users/${userId}/regenerate/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ previewToken, confirmed, acknowledgedWarnings, skipLocked, force })
    });
    return handleResponse(response);
};

// Credential History API (Story 2.5)

export const getCredentialHistory = async (userId, filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.system) params.append('system', filters.system);
    if (filters.startDate) params.append('startDate', toIsoDateTimeFilter(filters.startDate, false));
    if (filters.endDate) params.append('endDate', toIsoDateTimeFilter(filters.endDate, true));
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    
    const queryString = params.toString();
    const url = `${API_BASE}/credential-templates/users/${userId}/history${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, {
        credentials: 'include'
    });
    return handleResponse(response);
};

export const getCredentialVersion = async (versionId) => {
    const response = await fetch(`${API_BASE}/credential-templates/versions/${versionId}`, {
        credentials: 'include'
    });
    return handleResponse(response);
};

export const compareCredentialVersions = async (versionId1, versionId2) => {
    const response = await fetch(`${API_BASE}/credential-templates/versions/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ versionId1, versionId2 })
    });
    return handleResponse(response);
};

export const revealCredentialPassword = async (versionId) => {
    const response = await fetch(`${API_BASE}/credential-templates/versions/${versionId}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    });
    return handleResponse(response);
};

// Credential Override API (Story 2.6)

export const previewOverride = async (userId, system, overrideData) => {
    const response = await fetch(`${API_BASE}/credential-templates/users/${userId}/${system}/override/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(overrideData)
    });
    return handleResponse(response);
};

export const confirmOverride = async (userId, system, previewToken, confirmed = true) => {
    const response = await fetch(`${API_BASE}/credential-templates/users/${userId}/${system}/override/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ previewToken, confirmed })
    });
    return handleResponse(response);
};

// Credential Lock/Unlock API (Story 2.9)

export const lockCredential = async (userId, systemId, reason) => {
    const response = await fetch(`${CREDENTIALS_BASE}/${userId}/${systemId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason })
    });
    return handleResponse(response);
};

export const unlockCredential = async (userId, systemId) => {
    const response = await fetch(`${CREDENTIALS_BASE}/${userId}/${systemId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    });
    return handleResponse(response);
};

export const getLockStatus = async (userId, systemId) => {
    const response = await fetch(`${CREDENTIALS_BASE}/${userId}/${systemId}/lock-status`, {
        credentials: 'include'
    });
    return handleResponse(response);
};

export const getLockedCredentials = async (filters = {}) => {
    const response = await fetch(`${CREDENTIALS_BASE}/locked${buildQueryString(filters)}`, {
        credentials: 'include'
    });
    return handleResponse(response);
};

export const getUserLockedCredentials = async (userId, filters = {}) => {
    const response = await fetch(`${CREDENTIALS_BASE}/users/${userId}/locked${buildQueryString(filters)}`, {
        credentials: 'include'
    });
    return handleResponse(response);
};
