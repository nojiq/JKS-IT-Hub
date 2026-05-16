import { apiFetch } from "../../../shared/utils/api-client.js";

const ASSETS_BASE = "/api/v1/assets";

const createApiError = (payload = {}) => {
  const error = new Error(payload?.detail ?? "Request failed.");
  error.problem = payload;
  error.status = payload?.status;
  return error;
};

const parsePayload = async (response) => {
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw createApiError(payload);
  }

  if (payload.meta) {
    return { data: payload.data, meta: payload.meta };
  }

  return { data: payload?.data ?? null, meta: null };
};

const buildQuery = (filters = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, value);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

export const fetchAssets = async (filters = {}) => {
  const response = await apiFetch(`${ASSETS_BASE}${buildQuery(filters)}`);
  return parsePayload(response);
};

export const fetchAssetDetail = async (assetId) => {
  const response = await apiFetch(`${ASSETS_BASE}/${assetId}`);
  const { data } = await parsePayload(response);
  return data;
};

export const fetchAssetMeta = async () => {
  const response = await apiFetch(`${ASSETS_BASE}/meta`);
  const { data } = await parsePayload(response);
  return data ?? { statuses: [], categories: [] };
};

export const fetchAssetSyncStatus = async () => {
  const response = await apiFetch(`${ASSETS_BASE}/sync/status`);
  const { data } = await parsePayload(response);
  return data ?? { configured: false, enabled: false, latestRun: null };
};

export const triggerAssetSync = async () => {
  const response = await apiFetch(`${ASSETS_BASE}/sync`, { method: "POST" });
  const { data } = await parsePayload(response);
  return data;
};

export const linkAssetToUser = async (assetId, userId) => {
  const response = await apiFetch(`${ASSETS_BASE}/${assetId}/link-user`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId })
  });
  const { data } = await parsePayload(response);
  return data;
};

export const clearAssetUserLink = async (assetId) => {
  const response = await apiFetch(`${ASSETS_BASE}/${assetId}/link-user`, {
    method: "DELETE"
  });
  const { data } = await parsePayload(response);
  return data;
};
