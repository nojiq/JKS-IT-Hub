import { apiFetch, buildApiUrl } from "../../../shared/utils/api-client.js";
import {
    createPurchaseRecord,
    fetchAllPurchaseRecords,
    fetchMyPurchaseRecords,
    fetchPurchaseRecordDetails,
    verifyPurchaseRecordItemSnipe
} from "./purchaseRecordsApi.js";

export {
    createPurchaseRecord,
    fetchAllPurchaseRecords,
    fetchMyPurchaseRecords,
    fetchPurchaseRecordDetails,
    verifyPurchaseRecordItemSnipe
};

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

/** @deprecated Use createPurchaseRecord */
export const submitRequest = async ({ data, file, invoice, onProgress } = {}) =>
    createPurchaseRecord({ data, invoice: invoice ?? file, onProgress });

/** @deprecated Use fetchMyPurchaseRecords */
export const fetchMyRequests = fetchMyPurchaseRecords;

/** @deprecated Use fetchPurchaseRecordDetails */
export const fetchRequestDetails = fetchPurchaseRecordDetails;

/** @deprecated Use fetchAllPurchaseRecords */
export const fetchAllRequests = fetchAllPurchaseRecords;

/**
 * Upload an invoice file to an existing request (legacy route during transition).
 */
export const uploadInvoice = async (requestId, file, onProgress) => {
    const formData = new FormData();
    formData.append("invoice", file);

    if (typeof onProgress === "function") {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", buildApiUrl(`/api/v1/requests/${requestId}/invoice`));
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

    const response = await apiFetch(`/api/v1/requests/${requestId}/invoice`, {
        method: "POST",
        body: formData
    });

    return parsePayload(response);
};

export const itReviewRequest = async (id, data) => {
    const response = await apiFetch(`/api/v1/requests/${id}/it-review`, {
        method: "POST",
        body: JSON.stringify(data)
    });
    return parsePayload(response);
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
