import { apiFetch } from "../../shared/utils/api-client.js";

const parsePayload = async (response) => {
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message = payload?.detail ?? "Request failed.";
        throw new Error(message);
    }

    return payload;
};

export const fetchAuditLogs = async (params = {}) => {
    const {
        page = 1,
        limit = 20,
        action,
        actorId,
        startDate,
        endDate
    } = params;

    const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit)
    });

    if (action) queryParams.append('action', action);
    if (actorId) queryParams.append('actorId', actorId);
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);

    const response = await apiFetch(`/audit-logs?${queryParams.toString()}`);
    return parsePayload(response);
};
