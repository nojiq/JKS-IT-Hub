import { apiFetch } from "../../../shared/utils/api-client.js";

const BASE = "/api/v1/ip-list";

const createApiError = (payload = {}) => {
  const error = new Error(payload?.detail ?? "Request failed.");
  error.problem = payload;
  error.status = payload?.status;
  if (payload?.existing) error.existing = payload.existing;
  if (payload?.redirectTo) error.redirectTo = payload.redirectTo;
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

  return payload;
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

export const fetchIpInventory = async (filters = {}) => {
  const response = await apiFetch(`${BASE}${buildQuery(filters)}`);
  const payload = await parsePayload(response);
  const inner = payload?.data ?? {};
  return {
    rows: Array.isArray(inner.data) ? inner.data : [],
    groups: Array.isArray(inner.groups) ? inner.groups : []
  };
};

export const fetchIpDetail = async (ipAddress) => {
  const response = await apiFetch(`${BASE}/${encodeURIComponent(ipAddress)}`);
  const payload = await parsePayload(response);
  return payload?.data ?? null;
};

export const createManualIpRecord = async (body) => {
  const response = await apiFetch(`${BASE}/manual-records`, {
    method: "POST",
    body: JSON.stringify(body)
  });
  const payload = await parsePayload(response);
  return payload?.data ?? null;
};

export const updateManualIpRecord = async (id, body) => {
  const response = await apiFetch(`${BASE}/manual-records/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
  const payload = await parsePayload(response);
  return payload?.data ?? null;
};

export const deleteManualIpRecord = async (id) => {
  const response = await apiFetch(`${BASE}/manual-records/${id}`, {
    method: "DELETE"
  });
  const payload = await parsePayload(response);
  return payload?.data ?? null;
};

export const fetchSubnetRules = async () => {
  const response = await apiFetch(`${BASE}/subnets`);
  const payload = await parsePayload(response);
  return Array.isArray(payload?.data) ? payload.data : [];
};

export const createSubnetRule = async (body) => {
  const response = await apiFetch(`${BASE}/subnets`, {
    method: "POST",
    body: JSON.stringify(body)
  });
  const payload = await parsePayload(response);
  return payload?.data ?? null;
};

export const updateSubnetRule = async (id, body) => {
  const response = await apiFetch(`${BASE}/subnets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
  const payload = await parsePayload(response);
  return payload?.data ?? null;
};

export const deleteSubnetRule = async (id) => {
  const response = await apiFetch(`${BASE}/subnets/${id}`, {
    method: "DELETE"
  });
  const payload = await parsePayload(response);
  return payload?.data ?? null;
};
