import { apiFetch } from "../../../shared/utils/api-client.js";

const parsePayload = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.detail ?? "Request failed.");
    }
    return payload?.data ?? null;
};

export const fetchTemplates = async () => {
    const response = await apiFetch("/api/v1/credential-templates");
    return parsePayload(response);
};

export const fetchTemplate = async (id) => {
    const response = await apiFetch(`/api/v1/credential-templates/${id}`);
    return parsePayload(response);
};

export const createTemplate = async (data) => {
    const response = await apiFetch("/api/v1/credential-templates", {
        method: "POST",
        body: JSON.stringify(data)
    });
    return parsePayload(response);
};

export const updateTemplate = async (id, data) => {
    const response = await apiFetch(`/api/v1/credential-templates/${id}`, {
        method: "PUT",
        body: JSON.stringify(data)
    });
    return parsePayload(response);
};
