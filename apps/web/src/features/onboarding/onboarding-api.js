import { apiFetch } from "../../shared/utils/api-client.js";

const parsePayload = async (response) => {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.detail ?? "Request failed.");
    error.status = response.status;
    error.problemDetails = payload;
    throw error;
  }

  return payload?.data ?? null;
};

export const fetchCatalogItems = async () => {
  const response = await apiFetch("/api/v1/onboarding/catalog-items");
  return parsePayload(response);
};

export const createCatalogItem = async (data) => {
  const response = await apiFetch("/api/v1/onboarding/catalog-items", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return parsePayload(response);
};

export const updateCatalogItem = async (id, data) => {
  const response = await apiFetch(`/api/v1/onboarding/catalog-items/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
  return parsePayload(response);
};

export const deleteCatalogItem = async (id) => {
  const response = await apiFetch(`/api/v1/onboarding/catalog-items/${id}`, {
    method: "DELETE"
  });
  return parsePayload(response);
};

export const fetchDepartmentBundles = async () => {
  const response = await apiFetch("/api/v1/onboarding/department-bundles");
  return parsePayload(response);
};

export const createDepartmentBundle = async (data) => {
  const response = await apiFetch("/api/v1/onboarding/department-bundles", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return parsePayload(response);
};

export const updateDepartmentBundle = async (id, data) => {
  const response = await apiFetch(`/api/v1/onboarding/department-bundles/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
  return parsePayload(response);
};

export const deleteDepartmentBundle = async (id) => {
  const response = await apiFetch(`/api/v1/onboarding/department-bundles/${id}`, {
    method: "DELETE"
  });
  return parsePayload(response);
};

export const fetchManagedDepartments = async () => {
  const response = await apiFetch("/api/v1/onboarding/departments");
  return parsePayload(response);
};

export const fetchUsersForOnboarding = async (search = "") => {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }

  const url = params.toString()
    ? `/api/v1/onboarding/directory-users?${params.toString()}`
    : "/api/v1/onboarding/directory-users";
  const response = await apiFetch(url);
  return parsePayload(response);
};

export const previewOnboardingSetup = async (data) => {
  const response = await apiFetch("/api/v1/onboarding/preview", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return parsePayload(response);
};

export const confirmOnboardingSetup = async (data) => {
  const response = await apiFetch("/api/v1/onboarding/confirm", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return parsePayload(response);
};

export const fetchOnboardingDraft = async (draftId) => {
  const response = await apiFetch(`/api/v1/onboarding/drafts/${draftId}`);
  return parsePayload(response);
};

export const fetchOnboardingDrafts = async (status = "all") => {
  const params = new URLSearchParams();
  if (status && status !== "all") {
    params.set("status", status);
  }

  const query = params.toString();
  const response = await apiFetch(query ? `/api/v1/onboarding/drafts?${query}` : "/api/v1/onboarding/drafts");
  return parsePayload(response);
};

export const linkOnboardingDraft = async (draftId, userId) => {
  const response = await apiFetch(`/api/v1/onboarding/drafts/${draftId}/link`, {
    method: "POST",
    body: JSON.stringify({ userId })
  });
  return parsePayload(response);
};

export const linkAndPromoteOnboardingDraft = async (draftId, userId) => {
  const response = await apiFetch(`/api/v1/onboarding/drafts/${draftId}/link-and-promote`, {
    method: "POST",
    body: JSON.stringify({ userId })
  });
  return parsePayload(response);
};
