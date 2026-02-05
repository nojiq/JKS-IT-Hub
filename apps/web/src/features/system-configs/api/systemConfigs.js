import { apiFetch } from "../../../shared/utils/api-client.js";

const handleResponse = async (response) => {
    const data = await response.json();
    
    if (!response.ok) {
        const error = new Error(data.detail || data.title || 'Request failed');
        error.status = response.status;
        error.problemDetails = data;
        throw error;
    }
    
    return data;
};

export const getSystemConfigs = async () => {
    const response = await apiFetch("/system-configs");
    return handleResponse(response);
};

export const getSystemConfig = async (systemId) => {
    const response = await apiFetch(`/system-configs/${systemId}`);
    return handleResponse(response);
};

export const createSystemConfig = async (data) => {
    const response = await apiFetch("/system-configs", {
        method: "POST",
        body: JSON.stringify(data)
    });
    return handleResponse(response);
};

export const updateSystemConfig = async (systemId, data) => {
    const response = await apiFetch(`/system-configs/${systemId}`, {
        method: "PUT",
        body: JSON.stringify(data)
    });
    return handleResponse(response);
};

export const deleteSystemConfig = async (systemId) => {
    const response = await apiFetch(`/system-configs/${systemId}`, {
        method: "DELETE"
    });
    return handleResponse(response);
};

export const getAvailableLdapFields = async () => {
    const response = await apiFetch("/system-configs/ldap-fields/available");
    return handleResponse(response);
};
