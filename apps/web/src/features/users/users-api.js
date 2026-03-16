import { apiFetch } from "../../shared/utils/api-client.js";

const parsePayload = async (response) => {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.detail ?? "Request failed.";
    const error = new Error(message);
    error.status = response.status;
    error.problemDetails = payload;
    throw error;
  }

  // Handle new format with meta (for lists)
  if (payload.meta) {
    return {
      users: payload.data,
      fields: payload.meta.fields || [],
      meta: payload.meta
    };
  }

  return payload?.data ?? null;
};

export const fetchUsers = async (filters = {}) => {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value);
    }
  }

  const queryString = searchParams.toString();
  const url = queryString ? `/users?${queryString}` : "/users";

  const response = await apiFetch(url);
  return parsePayload(response);
};

export const fetchUserDetail = async (userId) => {
  const response = await apiFetch(`/users/${userId}`);
  return parsePayload(response);
};

export const fetchUserHistory = async (userId) => {
  const response = await apiFetch(`/users/${userId}/audit-logs`);
  return parsePayload(response);
};

export const updateUserStatus = async (userId, status) => {
  const response = await apiFetch(`/users/${userId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  return parsePayload(response);
};
