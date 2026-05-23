import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/features/ip-list/api/ipListApi.js", () => ({
  fetchIpInventory: vi.fn(),
  fetchSubnetRules: vi.fn(),
  fetchIpDetail: vi.fn(),
  createManualIpRecord: vi.fn(),
  updateManualIpRecord: vi.fn(),
  deleteManualIpRecord: vi.fn(),
  createSubnetRule: vi.fn(),
  updateSubnetRule: vi.fn(),
  deleteSubnetRule: vi.fn()
}));

import IpDetailPage from "../src/features/ip-list/pages/IpDetailPage.jsx";
import {
  deleteManualIpRecord,
  fetchIpDetail,
  updateManualIpRecord
} from "../src/features/ip-list/api/ipListApi.js";

const subnet = {
  id: "sub-server",
  cidr: "192.168.78.0/24",
  networkAddress: "192.168.78.0",
  prefixLength: 24,
  purpose: "Server",
  description: "App servers"
};

const assetDetail = {
  id: "row-1",
  source: "asset",
  ipAddress: "192.168.78.15",
  hostNumber: 15,
  hostname: "srv-app",
  subnet,
  asset: {
    id: "asset-1",
    assetTag: "JKS-001",
    name: "srv-app",
    serial: "SN-1",
    modelName: "ProLiant",
    categoryName: "Server",
    statusLabel: "Deployed",
    macAddressLan: "AA:BB:CC:DD:EE:FF",
    assignedToUser: { id: "user-1", username: "alice" },
    snipeAssignedName: "Alice Tan",
    snipeAssignedUsername: "alice",
    lastSyncedAt: "2026-05-16T10:00:00.000Z"
  },
  manualRecord: null,
  redirectTo: "/ip-list/192.168.78.15"
};

const manualDetail = {
  id: "row-2",
  source: "manual",
  ipAddress: "192.168.79.30",
  hostNumber: 30,
  hostname: "printer-finance",
  subnet,
  asset: null,
  manualRecord: {
    id: "manual-1",
    ipAddress: "192.168.79.30",
    hostname: "printer-finance",
    location: "HQ · L3",
    department: "Finance",
    macAddress: "11:22:33:44:55:66",
    notes: "Bizhub",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z"
  },
  redirectTo: "/ip-list/192.168.79.30"
};

const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

const renderDetail = (ipAddress) => {
  const router = createMemoryRouter(
    [
      { path: "/ip-list", element: <div>List view</div> },
      { path: "/ip-list/:ipAddress", element: <IpDetailPage /> },
      { path: "/assets/:id", element: <div>Asset page</div> }
    ],
    { initialEntries: [`/ip-list/${ipAddress}`] }
  );

  const result = render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );

  return { ...result, router };
};

describe("IpDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders asset detail with link back to asset", async () => {
    fetchIpDetail.mockResolvedValue(assetDetail);

    renderDetail("192.168.78.15");

    expect(await screen.findByRole("heading", { name: "192.168.78.15" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Asset details" })).toBeInTheDocument();
    const assetLink = screen.getByRole("link", { name: "Open asset" });
    expect(assetLink).toHaveAttribute("href", "/assets/asset-1");
    expect(screen.getByText("JKS-001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("renders manual detail with edit and delete actions", async () => {
    fetchIpDetail.mockResolvedValue(manualDetail);
    deleteManualIpRecord.mockResolvedValue({ id: "manual-1" });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const { router } = renderDetail("192.168.79.30");

    expect(await screen.findByRole("heading", { name: "Manual record" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getAllByText("printer-finance").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteManualIpRecord).toHaveBeenCalledWith("manual-1");
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/ip-list");
    });
  });

  it("submits update when editing manual record", async () => {
    fetchIpDetail.mockResolvedValue(manualDetail);
    updateManualIpRecord.mockResolvedValue({ ...manualDetail.manualRecord, hostname: "renamed" });

    renderDetail("192.168.79.30");
    await screen.findByRole("heading", { name: "Manual record" });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const hostnameInput = await screen.findByPlaceholderText("printer-finance");
    fireEvent.change(hostnameInput, { target: { value: "renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateManualIpRecord).toHaveBeenCalledWith(
        "manual-1",
        expect.objectContaining({ hostname: "renamed" })
      );
    });
  });
});
