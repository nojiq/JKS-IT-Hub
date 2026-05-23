import { randomUUID } from "node:crypto";
import net from "node:net";
import { uploadsConfig } from "../../config/uploads.js";
import { ensureUploadDir, saveFile } from "../../shared/uploads/storage.js";

const IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp"
};

const namedError = (name, message) => {
  const error = new Error(message);
  error.name = name;
  return error;
};

const isBlockedHost = (hostname) => {
  const normalized = hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(normalized)) return true;

  const ipVersion = net.isIP(normalized);
  if (ipVersion === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 10
      || a === 127
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 169 && b === 254)
      || a === 0;
  }
  if (ipVersion === 6) {
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80");
  }
  return false;
};

const assertRemoteImageUrl = (url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw namedError("ValidationError", "Invalid product image URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || isBlockedHost(parsed.hostname)) {
    throw namedError("ValidationError", "Unsupported product image URL");
  }
  return parsed;
};

const readLimitedBuffer = async (response) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > uploadsConfig.maxFileSize) {
      throw namedError("ValidationError", "Product image is too large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

export const createProductImageCache = ({ fetchImpl = globalThis.fetch } = {}) => ({
  async cacheRemoteProductImage(url) {
    let currentUrl = String(url);
    for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
      assertRemoteImageUrl(currentUrl);
      const response = await fetchImpl(currentUrl, { redirect: "manual" });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw namedError("ServiceUnavailable", "Product image redirect is missing location");
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!response.ok) throw namedError("ServiceUnavailable", "Product image download failed");
      const contentType = String(response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      const extension = IMAGE_TYPES[contentType];
      if (!extension) throw namedError("ValidationError", "Product image type is not supported");

      const buffer = await readLimitedBuffer(response);
      await ensureUploadDir();
      const fileName = `product-${randomUUID()}.${extension}`;
      await saveFile(buffer, fileName);
      return `/api/v1/uploads/${fileName}`;
    }

    throw namedError("ServiceUnavailable", "Product image redirected too many times");
  }
});
