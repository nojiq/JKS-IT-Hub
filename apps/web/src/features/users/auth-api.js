import { apiFetch } from "../../shared/utils/api-client.js";

export const login = async ({ username, password }) => {
  const response = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.detail ?? "Unable to sign in.";
    throw new Error(message);
  }

  return payload.data;
};

export const fetchSession = async () => {
  const response = await apiFetch("/auth/me");

  if (response.status === 401) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.detail ?? "Unable to verify session.";
    throw new Error(message);
  }

  return payload.data ?? null;
};

export const logout = async () => {
  const response = await apiFetch("/auth/logout", {
    method: "POST"
  });

  if (!response.ok && response.status !== 401) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.detail ?? "Unable to sign out.";
    throw new Error(message);
  }

  return true;
};
