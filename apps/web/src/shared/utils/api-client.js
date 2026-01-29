const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export const getApiBaseUrl = () => baseUrl;

export const buildApiUrl = (path) => `${baseUrl}${path}`;

export const apiFetch = async (path, options = {}) => {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  return response;
};
