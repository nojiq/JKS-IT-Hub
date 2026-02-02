const API_BASE = '/api/v1';

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

export const generateCredentials = async (userId) => {
    const response = await fetch(`${API_BASE}/credential-templates/users/${userId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    });
    return handleResponse(response);
};

export const previewCredentials = async (userId) => {
    const response = await fetch(`${API_BASE}/credential-templates/users/${userId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
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
