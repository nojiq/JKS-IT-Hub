const trimBaseUrl = (value) => String(value ?? "").replace(/\/+$/, "");

const withTimeout = async (promise, timeoutMs) => {
  if (!timeoutMs) return promise;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await promise(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};

export const createSnipeClient = ({ config = {}, fetchImpl = globalThis.fetch } = {}) => {
  const baseUrl = trimBaseUrl(config.baseUrl);
  const apiToken = config.apiToken;
  const timeoutMs = Math.max(1000, Number(config.timeoutMs ?? 15000));

  const isConfigured = () => Boolean(baseUrl && apiToken && fetchImpl);

  const request = async (path) => {
    if (!isConfigured()) {
      throw new Error("Snipe-IT client is not configured");
    }

    return withTimeout(async (signal) => {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: "GET",
        signal,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Snipe-IT request failed: ${response.status} ${body}`.trim());
      }

      return response.json();
    }, timeoutMs);
  };

  const fetchHardwarePage = async ({ limit = 100, offset = 0 } = {}) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset)
    });
    return request(`/api/v1/hardware?${params.toString()}`);
  };

  const fetchAllHardware = async ({ limit = 100 } = {}) => {
    const rows = [];
    let total = null;
    let offset = 0;

    do {
      const page = await fetchHardwarePage({ limit, offset });
      const pageRows = Array.isArray(page?.rows) ? page.rows : [];
      rows.push(...pageRows);
      total = Number.isFinite(Number(page?.total)) ? Number(page.total) : rows.length;
      offset += pageRows.length;
      if (pageRows.length === 0) break;
    } while (rows.length < total);

    return rows;
  };

  return { isConfigured, fetchHardwarePage, fetchAllHardware };
};
