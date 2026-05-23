import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/shared/utils/api-client.js", () => ({
    apiFetch: vi.fn(),
    buildApiUrl: vi.fn((path) => `https://it-api.jkseng.com${path}`)
}));

describe("purchaseRecords API client", () => {
    let apiFetch;
    let buildApiUrl;
    let createPurchaseRecord;
    let fetchMyPurchaseRecords;
    let fetchPurchaseRecordDetails;
    let fetchMarketplacePreview;
    let verifyPurchaseRecordItemSnipe;

    beforeEach(async () => {
        vi.resetModules();
        ({ apiFetch, buildApiUrl } = await import("../src/shared/utils/api-client.js"));
        ({
            createPurchaseRecord,
            fetchMyPurchaseRecords,
            fetchPurchaseRecordDetails,
            fetchMarketplacePreview,
            verifyPurchaseRecordItemSnipe
        } = await import("../src/features/requests/api/purchaseRecordsApi.js"));
    });

    it("creates purchase record with itemsJson and optional invoice", async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ data: { id: "rec-1", items: [{ itemName: "Laptop" }] } })
        });

        const invoice = new File(["pdf"], "invoice.pdf", { type: "application/pdf" });
        const result = await createPurchaseRecord({
            data: {
                reason: "New laptop",
                items: [{
                    itemName: "Laptop",
                    quantity: 1,
                    unitCost: "2499.00",
                    marketplaceSource: {
                        marketplace: "LAZADA",
                        sourceUrl: "https://www.lazada.com.my/products/laptop-i1.html",
                        imageUrl: "https://img.lazcdn.com/laptop.jpg",
                        snapshot: { categoryPath: ["Computers", "Laptops"] }
                    }
                }]
            },
            invoice
        });

        expect(result.id).toBe("rec-1");
        expect(apiFetch).toHaveBeenCalledWith("/api/v1/purchase-records", expect.objectContaining({
            method: "POST"
        }));

        const formData = apiFetch.mock.calls[0][1].body;
        expect(formData.get("reason")).toBe("New laptop");
        expect(formData.get("itemsJson")).toBe(JSON.stringify([{
            itemName: "Laptop",
            quantity: 1,
            unitCost: "2499.00",
            marketplaceSource: {
                marketplace: "LAZADA",
                sourceUrl: "https://www.lazada.com.my/products/laptop-i1.html",
                imageUrl: "https://img.lazcdn.com/laptop.jpg",
                snapshot: { categoryPath: ["Computers", "Laptops"] }
            }
        }]));
        expect(formData.get("invoice")).toBe(invoice);
    });

    it("fetches marketplace preview with pasted product URL", async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    marketplace: "SHOPEE",
                    name: "Mouse",
                    variants: [{ label: "Black", price: "59.90" }]
                }
            })
        });

        const result = await fetchMarketplacePreview("https://shopee.com.my/product/1/2");

        expect(apiFetch).toHaveBeenCalledWith(
            "/api/v1/purchase-records/marketplace-preview",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ url: "https://shopee.com.my/product/1/2" })
            })
        );
        expect(result.marketplace).toBe("SHOPEE");
    });

    it("lists own records from purchase-records endpoint", async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ data: [{ id: "rec-1" }], meta: { total: 1, page: 1, perPage: 20, totalPages: 1 } })
        });

        const result = await fetchMyPurchaseRecords({ search: "laptop", page: 2 });

        expect(apiFetch).toHaveBeenLastCalledWith("/api/v1/purchase-records?page=2&search=laptop");
        expect(result.data).toHaveLength(1);
    });

    it("maps legacy status filters for admin list compatibility", async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ data: [], meta: { total: 0, page: 1, perPage: 5, totalPages: 1 } })
        });

        const { fetchAllPurchaseRecords } = await import("../src/features/requests/api/purchaseRecordsApi.js");
        await fetchAllPurchaseRecords({ status: "IT_REVIEWED", page: 1, perPage: 5 });

        expect(apiFetch).toHaveBeenCalledWith(
            "/api/v1/purchase-records?recordStatus=RECORDED&approvalStatus=PENDING&page=1&perPage=5"
        );
    });

    it("fetches purchase record detail by id", async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ data: { id: "rec-1", items: [{ id: "item-1" }] } })
        });

        const detail = await fetchPurchaseRecordDetails("rec-1");
        expect(apiFetch).toHaveBeenCalledWith("/api/v1/purchase-records/rec-1");
        expect(detail.items).toHaveLength(1);
    });

    it("verifies snipe item with correct endpoint", async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ data: { snipeVerificationStatus: "VERIFIED" } })
        });

        await verifyPurchaseRecordItemSnipe("rec-1", "item-1", { snipeType: "HARDWARE", snipeId: 42 });

        expect(apiFetch).toHaveBeenCalledWith(
            "/api/v1/purchase-records/rec-1/items/item-1/verify-snipe",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ snipeType: "HARDWARE", snipeId: 42 })
            })
        );
    });

    it("uses xhr upload endpoint when progress callback provided", async () => {
        const xhrInstances = [];
        class MockXHR {
            constructor() {
                this.upload = { onprogress: null };
                this.onload = null;
                this.onerror = null;
                this.status = 200;
                this.responseText = JSON.stringify({ data: { id: "rec-2" } });
                xhrInstances.push(this);
            }
            open() {}
            send() {
                this.onload?.();
            }
        }

        global.XMLHttpRequest = MockXHR;

        const onProgress = vi.fn();
        const result = await createPurchaseRecord({
            data: { reason: "Mouse", items: [{ itemName: "Mouse", quantity: 2 }] },
            onProgress
        });

        expect(buildApiUrl).toHaveBeenCalledWith("/api/v1/purchase-records");
        expect(result.id).toBe("rec-2");
        expect(onProgress).toHaveBeenCalledWith(100);
    });
});
