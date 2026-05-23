const HOST_RULES = [
  { marketplace: "SHOPEE", host: "shopee.com.my" },
  { marketplace: "LAZADA", host: "lazada.com.my" }
];

const errorWithName = (name, message) => {
  const error = new Error(message);
  error.name = name;
  return error;
};

export const detectMarketplace = (value) => {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return null;
  const hostname = parsed.hostname.toLowerCase();
  return HOST_RULES.find((rule) => (
    hostname === rule.host || hostname.endsWith(`.${rule.host}`)
  ))?.marketplace ?? null;
};

export const assertSupportedMarketplaceUrl = (url) => {
  const marketplace = detectMarketplace(url);
  if (!marketplace) {
    throw errorWithName("ValidationError", "Only Shopee Malaysia and Lazada Malaysia product URLs are supported.");
  }
  return marketplace;
};

export const createPreviewRateLimiter = ({ limit = 20, windowMs = 60_000, now = () => Date.now() } = {}) => {
  const buckets = new Map();

  return {
    check(actorId) {
      const timestamp = now();
      const bucket = buckets.get(actorId) ?? [];
      const active = bucket.filter((entry) => timestamp - entry < windowMs);
      if (active.length >= limit) {
        throw errorWithName("TooManyRequests", "Too many marketplace preview requests. Try again shortly.");
      }
      active.push(timestamp);
      buckets.set(actorId, active);
    }
  };
};

export const createMarketplacePreviewService = ({ config, fetchImpl = globalThis.fetch, logger } = {}) => ({
  async preview(url) {
    assertSupportedMarketplaceUrl(url);

    const scraperConfig = config?.scraper ?? {};
    if (!scraperConfig.enabled) {
      throw errorWithName("ServiceUnavailable", "Marketplace preview service is not enabled.");
    }
    if (!fetchImpl) {
      throw errorWithName("ServiceUnavailable", "Marketplace preview HTTP client is not available.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), scraperConfig.timeoutMs ?? 15000);
    try {
      const response = await fetchImpl(`${scraperConfig.baseUrl}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller.signal
      });
      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }
      if (!response.ok) {
        const error = errorWithName("ValidationError", payload?.detail ?? "Marketplace preview failed.");
        if (response.status >= 500) error.name = "ServiceUnavailable";
        throw error;
      }
      return payload?.data ?? payload;
    } catch (error) {
      if (error.name === "AbortError") {
        throw errorWithName("ServiceUnavailable", "Marketplace preview timed out.");
      }
      if (["ValidationError", "ServiceUnavailable"].includes(error.name)) throw error;
      logger?.warn?.({ err: error }, "Marketplace preview failed");
      throw errorWithName("ServiceUnavailable", "Marketplace preview failed.");
    } finally {
      clearTimeout(timeout);
    }
  }
});
