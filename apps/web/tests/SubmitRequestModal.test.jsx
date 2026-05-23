import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn();

vi.mock("../src/features/requests/hooks/useRequests.js", () => ({
    useSubmitPurchaseRecord: () => ({
        isPending: false,
        mutateAsync
    })
}));

vi.mock("../src/features/requests/api/purchaseRecordsApi.js", () => ({
    fetchMarketplacePreview: vi.fn()
}));

vi.mock("../src/shared/hooks/useToast.js", () => ({
    useToast: () => ({ success: vi.fn() })
}));

vi.mock("../src/features/requests/components/InvoiceUploader.jsx", () => ({
    default: () => <div data-testid="invoice-uploader" />
}));

import SubmitRequestModal from "../src/features/requests/components/SubmitRequestModal.jsx";
import { fetchMarketplacePreview } from "../src/features/requests/api/purchaseRecordsApi.js";

const renderModal = () => render(
    <SubmitRequestModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />
);

describe("SubmitRequestModal", () => {
    beforeEach(() => {
        mutateAsync.mockReset();
        mutateAsync.mockResolvedValue({ id: "record-1" });
        fetchMarketplacePreview.mockReset();
    });

    it("shows validation errors when footer submit button is clicked", async () => {
        renderModal();

        fireEvent.click(screen.getByRole("button", { name: "Submit Request" }));

        expect(await screen.findByText("Reason is required")).toBeInTheDocument();
        expect(screen.getByText("Item name required")).toBeInTheDocument();
        expect(mutateAsync).not.toHaveBeenCalled();
    });

    it("submits filled manual item from footer submit button", async () => {
        renderModal();

        fireEvent.change(screen.getByLabelText(/Reason/), {
            target: { value: "Need replacement cable" }
        });
        fireEvent.change(screen.getByLabelText("Item name *"), {
            target: { value: "USB-C cable" }
        });

        fireEvent.click(screen.getByRole("button", { name: "Submit Request" }));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                reason: "Need replacement cable",
                items: [expect.objectContaining({ itemName: "USB-C cable" })]
            })
        }));
    });

    it("compacts marketplace titles before applying selected variant", async () => {
        const longProductName = [
            "UGREEN USB Type C Charger Cable fast Charging and Sync Data Cord Quick Charge 3.0 USB C Wire",
            "For Huawei P40 Pro Samsung galaxy a51 a12 Samsung Galaxy S20 Ultra iPad Air 4th Nintendo",
            "with Durable Braided Nylon Extra Long Marketplace SEO Title"
        ].join(" ");
        const variantLabel = "Type C Black / 0.5 / Type C";
        fetchMarketplacePreview.mockResolvedValue({
            marketplace: "LAZADA",
            name: longProductName,
            vendorName: "UGREEN",
            imageUrl: "https://img.example.com/product.webp",
            categoryPath: ["Mobiles", "Cables"],
            currency: "MYR",
            sourceUrl: "https://www.lazada.com.my/products/test.html",
            variants: [{
                label: variantLabel,
                options: { Color: "Type C Black", "Cable Length (M)": "0.5", Connection: "Type C" },
                price: "7.99",
                currency: "MYR",
                imageUrl: "https://img.example.com/variant.webp",
                available: true,
                skuId: "sku-1"
            }]
        });

        renderModal();

        fireEvent.change(screen.getByLabelText("Product URL"), {
            target: { value: "https://www.lazada.com.my/products/test.html" }
        });
        fireEvent.click(screen.getByRole("button", { name: "Fetch" }));
        await screen.findByText(longProductName);

        fireEvent.click(screen.getByRole("button", { name: "Use selected variant" }));

        const itemNameInput = screen.getByLabelText("Item name *");
        expect(itemNameInput.value.length).toBeLessThanOrEqual(200);
        expect(itemNameInput.value).toContain("...");
        expect(itemNameInput.value.endsWith(` - ${variantLabel}`)).toBe(true);

        fireEvent.change(screen.getByLabelText(/Reason/), {
            target: { value: "Need product from marketplace" }
        });
        fireEvent.click(screen.getByRole("button", { name: "Submit Request" }));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        const submittedItem = mutateAsync.mock.calls[0][0].data.items[0];
        expect(submittedItem.itemName.length).toBeLessThanOrEqual(200);
        expect(submittedItem.marketplaceSource.snapshot.productName).toBe(longProductName);
        expect(submittedItem.marketplaceSource.snapshot.appliedItemName).toBe(submittedItem.itemName);
    });
});
