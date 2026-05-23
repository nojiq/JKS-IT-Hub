import { describe, expect, it, vi } from "vitest";

vi.mock("../src/shared/utils/api-client.js", () => ({
    buildApiUrl: (path) => `http://localhost:3006${path}`
}));

import {
    getPrimaryItemImageUrl,
    getPurchaseItemImageUrl,
    resolveUploadUrl
} from "../src/features/requests/utils/purchaseRecordUtils.js";

describe("purchaseRecordUtils", () => {
    it("resolves local upload URLs against API base URL", () => {
        expect(resolveUploadUrl("/api/v1/uploads/product.webp")).toBe("http://localhost:3006/api/v1/uploads/product.webp");
    });

    it("keeps remote image URLs unchanged", () => {
        expect(resolveUploadUrl("https://img.example.com/product.webp")).toBe("https://img.example.com/product.webp");
    });

    it("resolves purchase item and primary record images", () => {
        const item = { imageFileUrl: "/api/v1/uploads/product.webp" };
        expect(getPurchaseItemImageUrl(item)).toBe("http://localhost:3006/api/v1/uploads/product.webp");
        expect(getPrimaryItemImageUrl({ items: [item] })).toBe("http://localhost:3006/api/v1/uploads/product.webp");
    });
});
