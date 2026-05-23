import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

import IpListPage from "../src/features/ip-list/pages/IpListPage.jsx";
import {
  createManualIpRecord,
  fetchIpDetail,
  fetchIpInventory,
  fetchSubnetRules
} from "../src/features/ip-list/api/ipListApi.js";

const subnetServer = {
  id: "sub-server",
  cidr: "192.168.78.0/24",
  networkAddress: "192.168.78.0",
  prefixLength: 24,
  purpose: "Server",
  description: null
};

const subnetPrinter = {
  id: "sub-printer",
  cidr: "192.168.79.0/24",
  networkAddress: "192.168.79.0",
  prefixLength: 24,
  purpose: "Printer",
  description: null
};

const assetRow = {
  id: "row-asset-1",
  source: "asset",
  ipAddress: "192.168.78.15",
  hostNumber: 15,
  hostname: "srv-app",
  subnet: subnetServer,
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
    lastSyncedAt: "2026-05-16T10:00:00.000Z"
  },
  manualRecord: null,
  redirectTo: "/ip-list/192.168.78.15"
};

const manualRow = {
  id: "row-manual-1",
  source: "manual",
  ipAddress: "192.168.79.30",
  hostNumber: 30,
  hostname: "printer-finance",
  subnet: subnetPrinter,
  asset: null,
  manualRecord: {
    id: "manual-1",
    ipAddress: "192.168.79.30",
    hostname: "printer-finance",
    location: "HQ · L3",
    department: "Finance",
    macAddress: "11:22:33:44:55:66",
    notes: "Bizhub C658",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z"
  },
  redirectTo: "/ip-list/192.168.79.30"
};

const groups = [
  { subnet: subnetServer, purpose: "Server", count: 1 },
  { subnet: subnetPrinter, purpose: "Printer", count: 1 }
];

const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

const renderPage = ({ initialEntries = ["/ip-list"] } = {}) => {
  const router = createMemoryRouter(
    [
      { path: "/ip-list", element: <IpListPage /> },
      { path: "/ip-list/:ipAddress", element: <div>Detail for {":ipAddress"}</div> }
    ],
    { initialEntries }
  );

  const result = render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );

  return { ...result, router };
};

describe("IpListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchIpInventory.mockResolvedValue({ rows: [assetRow, manualRow], groups });
    fetchSubnetRules.mockResolvedValue([subnetServer, subnetPrinter]);
    fetchIpDetail.mockImplementation(async (ip) => {
      if (ip === assetRow.ipAddress) return assetRow;
      if (ip === manualRow.ipAddress) return manualRow;
      const error = new Error("IP address not found");
      error.status = 404;
      throw error;
    });
  });

  it("renders rows grouped by subnet purpose and hides empty groups", async () => {
    fetchIpInventory.mockResolvedValueOnce({
      rows: [assetRow, manualRow],
      groups: [
        ...groups,
        { subnet: { ...subnetPrinter, id: "sub-empty", purpose: "Wi-Fi" }, purpose: "Wi-Fi", count: 0 }
      ]
    });

    renderPage();

    await screen.findByRole("heading", { name: "IP List" });
    expect(await screen.findByText(/192\.168\.78\.15/)).toBeInTheDocument();
    expect(screen.getByText(/192\.168\.79\.30/)).toBeInTheDocument();

    expect(screen.getByRole("region", { name: /Subnet group Server/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Subnet group Printer/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Wi-Fi/ })).not.toBeInTheDocument();
  });

  it("summary strip counts source totals", async () => {
    renderPage();
    await screen.findByText(/192\.168\.78\.15/);

    const strip = screen.getByLabelText("IP inventory summary");
    expect(within(strip).getByText("Known IPs").nextSibling.textContent).toBe("2");
    expect(within(strip).getByText("Asset-sourced").nextSibling.textContent).toBe("1");
    expect(within(strip).getByText("Manual").nextSibling.textContent).toBe("1");
  });

  it("filtering by source pill refetches with the source query param", async () => {
    renderPage();
    await screen.findByText(/192\.168\.78\.15/);

    fetchIpInventory.mockClear();
    fireEvent.click(screen.getByRole("radio", { name: "Manual" }));

    await waitFor(() => {
      expect(fetchIpInventory).toHaveBeenCalledWith(expect.objectContaining({ source: "manual" }));
    });
  });

  it("opens drawer on row click and sets focus query param", async () => {
    const { router } = renderPage();
    await screen.findByText(/192\.168\.78\.15/);

    const row = screen.getByText("192.168.78.15").closest("tr");
    fireEvent.click(row);

    await waitFor(() => {
      expect(router.state.location.search).toContain("focus=192.168.78.15");
    });
    expect(await screen.findByRole("dialog", { name: /IP detail 192\.168\.78\.15/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open full page" })).toHaveAttribute(
      "href",
      "/ip-list/192.168.78.15"
    );
  });

  it("reopens drawer from focus query param on mount", async () => {
    renderPage({ initialEntries: ["/ip-list?focus=192.168.79.30"] });

    expect(await screen.findByRole("dialog", { name: /IP detail 192\.168\.79\.30/i })).toBeInTheDocument();
  });

  it("clicking group header filters inventory by subnet", async () => {
    renderPage();
    await screen.findByText(/192\.168\.78\.15/);

    const serverGroup = screen.getByRole("region", { name: /Subnet group Server/ });
    fetchIpInventory.mockClear();
    fireEvent.click(
      within(serverGroup).getByRole("button", { name: /Server · 192\.168\.78\.0\/24/ })
    );

    await waitFor(() => {
      expect(fetchIpInventory).toHaveBeenCalledWith(
        expect.objectContaining({ subnetId: "sub-server" })
      );
    });
  });

  it("subnet combobox lists rules with counts and filters on selection", async () => {
    fetchIpInventory.mockResolvedValue({
      rows: [assetRow, manualRow],
      groups: [
        { subnet: subnetServer, purpose: "Server", count: 1 },
        { subnet: subnetPrinter, purpose: "Printer", count: 1 },
        { subnet: null, purpose: "Unmapped", count: 0 }
      ]
    });

    renderPage();
    await screen.findByText(/192\.168\.78\.15/);

    const combobox = screen.getByRole("combobox", { name: "Subnet" });
    fireEvent.focus(combobox);

    const listbox = await screen.findByRole("listbox", { name: "Subnet filter options" });
    expect(within(listbox).getByRole("option", { name: /Server/ })).toHaveTextContent("1");
    expect(within(listbox).getByRole("option", { name: /Printer/ })).toHaveTextContent("1");

    fetchIpInventory.mockClear();
    fireEvent.click(within(listbox).getByRole("option", { name: /Printer/ }));

    await waitFor(() => {
      expect(fetchIpInventory).toHaveBeenCalledWith(
        expect.objectContaining({ subnetId: "sub-printer" })
      );
    });
  });

  it("typing 78 in subnet combobox filters to detected /24 prefix client-side", async () => {
    const unmapped78 = {
      id: "row-unmapped-78",
      source: "manual",
      ipAddress: "192.168.78.50",
      hostNumber: 50,
      hostname: "switch-78",
      subnet: null,
      asset: null,
      manualRecord: {
        id: "manual-78",
        ipAddress: "192.168.78.50",
        hostname: "switch-78",
        location: null,
        department: null,
        macAddress: null,
        notes: null,
        createdAt: "2026-05-10T00:00:00.000Z",
        updatedAt: "2026-05-10T00:00:00.000Z"
      },
      redirectTo: "/ip-list/192.168.78.50"
    };

    const unmapped79 = {
      ...unmapped78,
      id: "row-unmapped-79",
      ipAddress: "192.168.79.30",
      hostNumber: 30,
      hostname: "printer-other",
      manualRecord: {
        ...unmapped78.manualRecord,
        id: "manual-79",
        ipAddress: "192.168.79.30",
        hostname: "printer-other"
      },
      redirectTo: "/ip-list/192.168.79.30"
    };

    fetchIpInventory.mockResolvedValue({
      rows: [unmapped78, unmapped79],
      groups: [{ subnet: null, purpose: "Unmapped", count: 2 }]
    });
    fetchSubnetRules.mockResolvedValue([]);

    renderPage();
    await screen.findByText(/192\.168\.78\.50/);

    const combobox = screen.getByRole("combobox", { name: "Subnet" });
    fireEvent.focus(combobox);
    fireEvent.change(combobox, { target: { value: "78" } });

    const listbox = await screen.findByRole("listbox", { name: "Subnet filter options" });
    fireEvent.click(within(listbox).getByRole("option", { name: /192\.168\.78\.x/ }));

    await waitFor(() => {
      expect(screen.getByText("192.168.78.50")).toBeInTheDocument();
      expect(screen.queryByText("192.168.79.30")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Save as subnet rule" })).toHaveAttribute(
      "href",
      "/ip-list/subnets"
    );
  });

  it("clicking purpose chip filters to that subnet", async () => {
    renderPage();
    await screen.findByText(/192\.168\.78\.15/);

    fetchIpInventory.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Filter to Server" }));

    await waitFor(() => {
      expect(fetchIpInventory).toHaveBeenCalledWith(
        expect.objectContaining({ subnetId: "sub-server" })
      );
    });
  });

  it("unmapped combobox filter shows only IPs without a subnet rule", async () => {
    const unmappedRow = {
      id: "row-unmapped",
      source: "manual",
      ipAddress: "10.0.0.50",
      hostNumber: 50,
      hostname: "orphan",
      subnet: null,
      asset: null,
      manualRecord: {
        id: "manual-orphan",
        ipAddress: "10.0.0.50",
        hostname: "orphan",
        location: null,
        department: null,
        macAddress: null,
        notes: null,
        createdAt: "2026-05-10T00:00:00.000Z",
        updatedAt: "2026-05-10T00:00:00.000Z"
      },
      redirectTo: "/ip-list/10.0.0.50"
    };

    fetchIpInventory.mockResolvedValue({
      rows: [assetRow, manualRow, unmappedRow],
      groups: [
        { subnet: subnetServer, purpose: "Server", count: 1 },
        { subnet: subnetPrinter, purpose: "Printer", count: 1 },
        { subnet: null, purpose: "Unmapped", count: 1 }
      ]
    });

    renderPage();
    await screen.findByText(/192\.168\.78\.15/);

    const combobox = screen.getByRole("combobox", { name: "Subnet" });
    fireEvent.focus(combobox);
    const listbox = await screen.findByRole("listbox", { name: "Subnet filter options" });
    fireEvent.click(within(listbox).getByRole("option", { name: /Unmapped/ }));

    await waitFor(() => {
      expect(screen.getByText("10.0.0.50")).toBeInTheDocument();
      expect(screen.queryByText("192.168.78.15")).not.toBeInTheDocument();
    });
  });

  it("links manage subnets to dedicated route from combobox", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "IP List" });

    fireEvent.focus(screen.getByRole("combobox", { name: "Subnet" }));
    const link = await screen.findByRole("link", { name: "Manage subnets" });
    expect(link).toHaveAttribute("href", "/ip-list/subnets");
  });

  it("shows first-run empty state when no rules and no IPs", async () => {
    fetchIpInventory.mockResolvedValue({ rows: [], groups: [] });
    fetchSubnetRules.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No IPs or subnet rules yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add first subnet" })).toHaveAttribute("href", "/ip-list/subnets");
  });

  it("submits manual IP create payload", async () => {
    createManualIpRecord.mockResolvedValue({
      id: "manual-new",
      ipAddress: "192.168.78.99",
      hostname: "switch-finance",
      source: "manual"
    });

    const { router } = renderPage();
    await screen.findByText(/192\.168\.78\.15/);

    fireEvent.click(screen.getByRole("button", { name: "Add manual IP" }));

    await screen.findByRole("heading", { name: "Add manual IP" });
    fireEvent.change(screen.getByPlaceholderText("192.168.78.15"), {
      target: { value: "192.168.78.99" }
    });
    fireEvent.change(screen.getByPlaceholderText("printer-finance"), {
      target: { value: "switch-finance" }
    });
    fireEvent.change(screen.getByPlaceholderText("HQ · Level 3"), {
      target: { value: "Server room" }
    });
    fireEvent.change(screen.getByPlaceholderText("Finance"), {
      target: { value: "IT" }
    });
    fireEvent.change(screen.getByPlaceholderText("AA:BB:CC:DD:EE:FF"), {
      target: { value: "01:02:03:04:05:06" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => {
      expect(createManualIpRecord).toHaveBeenCalledWith({
        ipAddress: "192.168.78.99",
        hostname: "switch-finance",
        location: "Server room",
        department: "IT",
        macAddress: "01:02:03:04:05:06",
        notes: null
      });
    });

    await waitFor(() => {
      expect(router.state.location.search).toContain("focus=192.168.78.99");
    });
  });

  it("shows duplicate banner and opens drawer for existing IP on 409 response", async () => {
    const error = Object.assign(new Error("IP address already exists"), {
      status: 409,
      existing: {
        source: "asset",
        id: "asset-1",
        ipAddress: "192.168.78.15",
        label: "JKS-001"
      },
      redirectTo: "/ip-list/192.168.78.15"
    });
    createManualIpRecord.mockRejectedValue(error);

    const { router } = renderPage();
    await screen.findByText(/192\.168\.78\.15/);

    fireEvent.click(screen.getByRole("button", { name: "Add manual IP" }));
    fireEvent.change(screen.getByPlaceholderText("192.168.78.15"), {
      target: { value: "192.168.78.15" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByText("IP address already exists.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open existing record" }));

    await waitFor(() => {
      expect(router.state.location.search).toContain("focus=192.168.78.15");
    });
  });
});
