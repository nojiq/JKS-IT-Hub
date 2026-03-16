export const webBaseUrl = process.env.E2E_WEB_BASE_URL ?? "http://localhost:5176";
export const apiBaseUrl = process.env.E2E_API_BASE_URL ?? "http://localhost:3006";

export const webUrl = (path = "") => `${webBaseUrl}${path}`;
export const apiUrl = (path = "") => `${apiBaseUrl}${path}`;
