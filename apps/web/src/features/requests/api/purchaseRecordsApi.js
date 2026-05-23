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
    return payload;
};

const appendRecordFields = (formData, data = {}) => {
    const scalarFields = [
        "reason",
        "requestedForUserId",
        "purchasedById",
        "purchaseDate",
        "vendorName",
        "totalAmount",
        "currency",
        "notes",
        "approvalStatus",
        "approvalSkipReason",
        "approvalNote"
    ];

    for (const key of scalarFields) {
        const value = data[key];
        if (value !== undefined && value !== null && value !== "") {
            formData.append(key, String(value));
        }
    }

    if (Array.isArray(data.items) && data.items.length > 0) {
        formData.append("itemsJson", JSON.stringify(data.items));
    }
};

const postMultipart = async ({ url, formData, onProgress }) => {
    if (typeof onProgress === "function") {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", buildApiUrl(url));
            xhr.withCredentials = true;

            xhr.upload.onprogress = (event) => {
                if (!event.lengthComputable) return;
                const percent = Math.round((event.loaded / event.total) * 100);
                onProgress(percent);
            };

            xhr.onerror = () => reject(new Error("Request failed."));

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

    const response = await apiFetch(url, { method: "POST", body: formData });
    return parsePayload(response);
};

export const createPurchaseRecord = async ({ data, invoice, onProgress } = {}) => {
    const formData = new FormData();
    appendRecordFields(formData, data);
    if (invoice) formData.append("invoice", invoice);

    return postMultipart({
        url: "/api/v1/purchase-records",
        formData,
        onProgress
    });
};

const LEGACY_STATUS_FILTERS = {
    SUBMITTED: { recordStatus: "RECORDED", approvalStatus: "NOT_REQUIRED" },
    IT_REVIEWED: { recordStatus: "RECORDED", approvalStatus: "PENDING" },
    APPROVED: { recordStatus: "RECORDED", approvalStatus: "APPROVED" },
    REJECTED: { recordStatus: "REJECTED" },
    ALREADY_PURCHASED: { recordStatus: "RECORDED", approvalStatus: "SKIPPED" }
};

const buildListQuery = (filters = {}) => {
    const query = new URLSearchParams();
    const legacy = LEGACY_STATUS_FILTERS[filters.status];
    const recordStatus = filters.recordStatus ?? legacy?.recordStatus;
    const approvalStatus = filters.approvalStatus ?? legacy?.approvalStatus;

    if (recordStatus) query.append("recordStatus", recordStatus);
    if (approvalStatus) query.append("approvalStatus", approvalStatus);
    if (filters.requesterId) query.append("requesterId", filters.requesterId);
    if (filters.dateFrom) query.append("dateFrom", filters.dateFrom);
    if (filters.dateTo) query.append("dateTo", filters.dateTo);
    if (filters.page) query.append("page", filters.page);
    if (filters.perPage) query.append("perPage", filters.perPage);
    if (filters.search) query.append("search", filters.search);
    return query;
};

export const fetchMyPurchaseRecords = async (filters = {}) => {
    const query = buildListQuery(filters);
    const response = await apiFetch(`/api/v1/purchase-records?${query.toString()}`);
    return parseListPayload(response);
};

export const fetchAllPurchaseRecords = async (filters = {}) => {
    const query = buildListQuery(filters);
    const response = await apiFetch(`/api/v1/purchase-records?${query.toString()}`);
    return parseListPayload(response);
};

export const fetchPurchaseRecordDetails = async (id) => {
    const response = await apiFetch(`/api/v1/purchase-records/${id}`);
    return parsePayload(response);
};

export const fetchMarketplacePreview = async (url) => {
    const response = await apiFetch("/api/v1/purchase-records/marketplace-preview", {
        method: "POST",
        body: JSON.stringify({ url })
    });
    return parsePayload(response);
};

export const verifyPurchaseRecordItemSnipe = async (recordId, itemId, payload) => {
    const response = await apiFetch(
        `/api/v1/purchase-records/${recordId}/items/${itemId}/verify-snipe`,
        {
            method: "POST",
            body: JSON.stringify(payload)
        }
    );
    return parsePayload(response);
};
