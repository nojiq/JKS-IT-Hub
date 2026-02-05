const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export const getApiBaseUrl = () => baseUrl;

export const buildApiUrl = (path) => `${baseUrl}${path}`;

export const apiFetch = async (path, options = {}) => {
  const headers = {
    ...(options.headers ?? {})
  };
  const hasBody = options.body !== undefined && options.body !== null;
  const isStringBody = typeof options.body === "string";
  if (hasBody && isStringBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...options,
    headers
  });

  return response;
};
