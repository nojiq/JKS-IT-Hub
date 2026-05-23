import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpDetailDrawer } from "../src/features/ip-list/components/IpDetailDrawer.jsx";

vi.mock("../src/features/ip-list/api/ipListApi.js", () => ({
  fetchIpDetail: vi.fn()
}));

import { fetchIpDetail } from "../src/features/ip-list/api/ipListApi.js";

const row = {
  id: "row-1",
  source: "asset",
  ipAddress: "192.168.78.15",
  hostNumber: 15,
  hostname: "srv-app",
  subnet: {
    id: "sub-1",
    cidr: "192.168.78.0/24",
    purpose: "Server",
    networkAddress: "192.168.78.0",
    prefixLength: 24
  },
  asset: {
    id: "asset-1",
    assetTag: "JKS-001",
    name: "srv-app",
    statusLabel: "Deployed"
  },
  manualRecord: null
};

const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

describe("IpDetailDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchIpDetail.mockResolvedValue(row);
  });

  it("renders drawer with asset details and close control", async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <QueryClientProvider client={createQueryClient()}>
          <IpDetailDrawer ipAddress="192.168.78.15" previewRow={row} onClose={onClose} />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("JKS-001")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open full page" })).toHaveAttribute(
      "href",
      "/ip-list/192.168.78.15"
    );

    fireEvent.click(screen.getByRole("button", { name: "Close drawer" }));
    expect(onClose).toHaveBeenCalled();
  });
});
