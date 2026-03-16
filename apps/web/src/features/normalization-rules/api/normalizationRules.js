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

export const getNormalizationRules = async () => {
    const response = await apiFetch("/api/v1/normalization-rules");
    return handleResponse(response);
};

export const createNormalizationRule = async (data) => {
    const response = await apiFetch("/api/v1/normalization-rules", {
        method: "POST",
        body: JSON.stringify(data)
    });
    return handleResponse(response);
};

export const updateNormalizationRule = async (ruleId, data) => {
    const response = await apiFetch(`/api/v1/normalization-rules/${ruleId}`, {
        method: "PUT",
        body: JSON.stringify(data)
    });
    return handleResponse(response);
};

export const deleteNormalizationRule = async (ruleId) => {
    const response = await apiFetch(`/api/v1/normalization-rules/${ruleId}`, {
        method: "DELETE"
    });
    return handleResponse(response);
};

export const reorderNormalizationRules = async (ruleIds) => {
    const response = await apiFetch("/api/v1/normalization-rules/reorder", {
        method: "POST",
        body: JSON.stringify({ ruleIds })
    });
    return handleResponse(response);
};

export const previewNormalization = async (value, systemId = null) => {
    const response = await apiFetch("/api/v1/normalization-rules/preview", {
        method: "POST",
        body: JSON.stringify({ value, systemId })
    });
    return handleResponse(response);
};
