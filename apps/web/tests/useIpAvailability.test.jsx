import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIpAvailability } from "../src/features/ip-list/hooks/useIpAvailability.js";

vi.mock("../src/features/ip-list/api/ipListApi.js", () => ({
  fetchIpDetail: vi.fn()
}));

import { fetchIpDetail } from "../src/features/ip-list/api/ipListApi.js";

const wrapper = ({ children }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}
  >
    {children}
  </QueryClientProvider>
);

describe("useIpAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports available when probe returns 404", async () => {
    const error = new Error("IP address not found");
    error.status = 404;
    fetchIpDetail.mockRejectedValue(error);

    const { result } = renderHook(() => useIpAvailability("192.168.78.200"), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("available");
    });
  });

  it("reports taken when probe finds a record", async () => {
    fetchIpDetail.mockResolvedValue({
      ipAddress: "192.168.78.15",
      source: "asset",
      asset: { assetTag: "JKS-001" }
    });

    const { result } = renderHook(() => useIpAvailability("192.168.78.15"), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("taken");
    });
  });
});
