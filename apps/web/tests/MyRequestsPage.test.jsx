import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../src/features/requests/hooks/useRequests.js", () => ({
    purchaseRecordsKeys: { all: ["purchase-records"] },
    useMyPurchaseRecords: vi.fn(),
    usePurchaseRecordDetails: vi.fn()
}));

vi.mock("../src/shared/hooks/useSSE.js", () => ({
    useSSE: vi.fn()
}));

vi.mock("../src/shared/hooks/useToast.js", () => ({
    useToast: () => ({ success: vi.fn(), warning: vi.fn(), info: vi.fn() })
}));

vi.mock("../src/shared/hooks/useFilterParams", () => ({
    useFilterParams: () => ({
        filters: { page: 1, perPage: 20 },
        setFilter: vi.fn(),
        clearFilters: vi.fn()
    })
}));

vi.mock("../src/features/requests/components/SubmitRequestModal.jsx", () => ({
    default: ({ isOpen }) => (isOpen ? <div data-testid="submit-modal">Submit modal</div> : null)
}));

vi.mock("../src/features/requests/components/RequestDetailModal.jsx", () => ({
    default: () => <div data-testid="detail-modal">Detail modal</div>
}));

import MyRequestsPage from "../src/features/requests/pages/MyRequestsPage.jsx";
import { useMyPurchaseRecords, usePurchaseRecordDetails } from "../src/features/requests/hooks/useRequests.js";

const sampleRecord = {
    id: "rec-1",
    reason: "Office chairs",
    recordStatus: "RECORDED",
    approvalStatus: "NOT_REQUIRED",
    createdAt: "2026-05-21T10:00:00.000Z",
    updatedAt: "2026-05-21T10:00:00.000Z",
    items: [
        { id: "item-1", itemName: "Ergonomic Chair", quantity: 2 },
        { id: "item-2", itemName: "Desk Mat", quantity: 1 }
    ]
};

function renderPage(initialEntry = "/requests/my-requests") {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[initialEntry]}>
                <Routes>
                    <Route path="/requests/my-requests" element={<MyRequestsPage />} />
                    <Route path="/requests/:id" element={<MyRequestsPage />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    );
}

describe("MyRequestsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useMyPurchaseRecords.mockReturnValue({
            data: { data: [sampleRecord], meta: { total: 1, page: 1, perPage: 20, totalPages: 1 } },
            isLoading: false,
            error: null,
            isFetching: false
        });
        usePurchaseRecordDetails.mockReturnValue({
            data: null,
            isLoading: false
        });
    });

    it("renders purchase records from purchase-records query", () => {
        renderPage();
        expect(screen.getByText("My Purchase Records")).toBeInTheDocument();
        expect(screen.getByText("Ergonomic Chair")).toBeInTheDocument();
        expect(screen.getByText("2 items")).toBeInTheDocument();
        expect(screen.getByText(/Office chairs/)).toBeInTheDocument();
    });

    it("keeps submit modal closed without submit query param", () => {
        renderPage();
        expect(screen.queryByTestId("submit-modal")).not.toBeInTheDocument();
    });

    it("opens submit modal when submit query param is present", () => {
        renderPage("/requests/my-requests?submit=1");
        expect(screen.getByTestId("submit-modal")).toBeInTheDocument();
    });
});
