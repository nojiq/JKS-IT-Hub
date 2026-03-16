import { apiFetch, buildApiUrl } from "../../../shared/utils/api-client.js";

const parsePayload = async (response) => {
    let payload;
    try {
        payload = await response.json();
    } catch {
        payload = {};
    }

    if (!response.ok) {
        throw new Error(payload?.detail ?? "Request failed.");
    }
    return payload?.data ?? null;
};

const parseListPayload = async (response) => {
    let payload;
    try {
        payload = await response.json();
    } catch {
        payload = {};
    }

    if (!response.ok) {
        throw new Error(payload?.detail ?? "Request failed.");
    }
    return payload; // Returns { data, meta }
};

export const submitRequest = async ({ data, file, onProgress } = {}) => {
    if (!file) {
        throw new Error("E-invoice is required.");
    }

    const formData = new FormData();
    Object.entries(data || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            formData.append(key, String(value));
        }
    });
    formData.append("invoice", file);

    if (typeof onProgress === "function") {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", buildApiUrl("/api/v1/requests/with-invoice"));
            xhr.withCredentials = true;

            xhr.upload.onprogress = (event) => {
                if (!event.lengthComputable) return;
                const percent = Math.round((event.loaded / event.total) * 100);
                onProgress(percent);
            };

            xhr.onerror = () => {
                reject(new Error("Request failed."));
            };

            xhr.onload = () => {
                let payload = {};
                try {
                    payload = JSON.parse(xhr.responseText || "{}");
                } catch {
                    payload = {};
                }

                if (xhr.status < 200 || xhr.status >= 300) {
                    reject(new Error(payload?.detail ?? "Request failed."));
                    return;
                }

                onProgress(100);
                resolve(payload?.data ?? null);
            };

            xhr.send(formData);
        });
    }

    const response = await apiFetch("/api/v1/requests/with-invoice", {
        method: "POST",
        body: formData
    });
    return parsePayload(response);
};

export const fetchMyRequests = async (filters = {}) => {
    const query = new URLSearchParams();
    if (filters.status) query.append('status', filters.status);
    if (filters.priority) query.append('priority', filters.priority);
    if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) query.append('dateTo', filters.dateTo);
    if (filters.page) query.append('page', filters.page);
    if (filters.perPage) query.append('perPage', filters.perPage);
    if (filters.search) query.append('search', filters.search);

    const response = await apiFetch(`/api/v1/requests/my-requests?${query.toString()}`);
    return parseListPayload(response);
};

export const fetchRequestDetails = async (id) => {
    const response = await apiFetch(`/api/v1/requests/${id}`);
    return parsePayload(response);
};

/**
 * Upload an invoice file to an existing request
 * @param {string} requestId - Request ID
 * @param {File} file - File to upload
 * @param {function} onProgress - Optional progress callback
 * @returns {Promise<Object>} Updated request
 */
export const uploadInvoice = async (requestId, file, onProgress) => {
    const formData = new FormData();
    formData.append('invoice', file);

    if (typeof onProgress === 'function') {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', buildApiUrl(`/api/v1/requests/${requestId}/invoice`));
            xhr.withCredentials = true;

            xhr.upload.onprogress = (event) => {
                if (!event.lengthComputable) return;
                const percent = Math.round((event.loaded / event.total) * 100);
                onProgress(percent);
            };

            xhr.onerror = () => {
                reject(new Error('Request failed.'));
            };

            xhr.onload = () => {
                let payload = {};
                try {
                    payload = JSON.parse(xhr.responseText || '{}');
                } catch {
                    payload = {};
                }

                if (xhr.status < 200 || xhr.status >= 300) {
                    reject(new Error(payload?.detail ?? 'Request failed.'));
                    return;
                }

                onProgress(100);
                resolve(payload?.data ?? null);
            };

            xhr.send(formData);
        });
    }

    const response = await apiFetch(`/api/v1/requests/${requestId}/invoice`, {
        method: 'POST',
        body: formData
    });

    return parsePayload(response);
};

export const fetchAllRequests = async (filters = {}) => {
    const query = new URLSearchParams();
    if (filters.status) query.append('status', filters.status);
    if (filters.priority) query.append('priority', filters.priority);
    if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) query.append('dateTo', filters.dateTo);
    if (filters.page) query.append('page', filters.page);
    if (filters.perPage) query.append('perPage', filters.perPage);
    if (filters.search) query.append('search', filters.search);
    if (filters.requesterId) query.append('requesterId', filters.requesterId);

    const response = await apiFetch(`/api/v1/requests?${query.toString()}`);
    // Use parseListPayload to handle { data, meta } structure
    return parseListPayload(response);
};

export const itReviewRequest = async (id, data) => {
    const response = await apiFetch(`/api/v1/requests/${id}/it-review`, {
        method: "POST",
        body: JSON.stringify(data)
    });
    return parsePayload(response); // Returns payload.data or null
};

export const rejectRequest = async (id, data) => {
    const response = await apiFetch(`/api/v1/requests/${id}/reject`, {
        method: "POST",
        body: JSON.stringify(data)
    });
    return parsePayload(response);
};

export const markAlreadyPurchased = async (id, data) => {
    const response = await apiFetch(`/api/v1/requests/${id}/already-purchased`, {
        method: "POST",
        body: JSON.stringify(data)
    });
    return parsePayload(response);
};



export const approveRequest = async (id) => {
    const response = await apiFetch(`/api/v1/requests/${id}/approve`, {
        method: "POST"
    });
    return parsePayload(response);
};
