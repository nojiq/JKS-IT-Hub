import { apiFetch } from "../../shared/utils/api-client.js";

const parsePayload = async (response) => {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.detail ?? "Request failed.";
    throw new Error(message);
  }

  return payload?.data ?? null;
};

export const fetchUsers = async () => {
  const response = await apiFetch("/users");
  return parsePayload(response);
};

export const fetchUserDetail = async (userId) => {
  const response = await apiFetch(`/users/${userId}`);
  return parsePayload(response);
};
