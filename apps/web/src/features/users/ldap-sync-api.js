import { apiFetch, getApiBaseUrl } from "../../shared/utils/api-client.js";

export const fetchLatestSync = async () => {
  const response = await apiFetch("/ldap/sync/latest");
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.detail ?? "Unable to load sync status.";
    throw new Error(message);
  }

  return payload?.data?.run ?? null;
};

export const triggerLdapSync = async () => {
  const response = await apiFetch("/ldap/sync", {
    method: "POST"
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.detail ?? "Unable to start LDAP sync.";
    throw new Error(message);
  }

  return payload?.data ?? null;
};

export const getLdapSyncStreamUrl = () => {
  return `${getApiBaseUrl()}/ldap/sync/stream`;
};
