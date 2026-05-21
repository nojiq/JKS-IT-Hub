import { render, screen } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssetsListPage from "../src/features/assets/pages/AssetsListPage.jsx";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    error: null
  })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  keepPreviousData: Symbol("keepPreviousData")
}));

import { useQuery } from "@tanstack/react-query";

const createQueryResult = (overrides = {}) => ({
  data: null,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  ...overrides
});

const sessionUser = { id: "u1", username: "viewer", role: "user", status: "active" };

const renderPage = () => {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <Outlet context={{ user: sessionUser }} />,
        children: [{ path: "assets", element: <AssetsListPage /> }]
      }
    ],
    { initialEntries: ["/assets"] }
  );

  return render(<RouterProvider router={router} />);
};

describe("AssetsListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assets" && queryKey[1] === "list") {
        return createQueryResult({ isLoading: true });
      }
      return createQueryResult();
    });

    renderPage();
    expect(screen.getByText("Loading assets")).toBeInTheDocument();
  });

  it("renders inventory header and asset row", () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assets" && queryKey[1] === "list") {
        return createQueryResult({
          data: {
            data: [
              {
                id: "asset-1",
                assetTag: "JKS-100",
                modelName: "MacBook Pro",
                serial: "SN1",
                categoryName: "Laptops",
                statusLabel: "Deployed",
                ipAddress: "192.168.78.29",
                macAddressLan: "LAN: b0-83-fe-6f-7d-0b / synced value",
                macAddressWifi5Ghz: "not provided",
                assignmentSource: "auto_username",
                lastSyncedAt: "2026-05-16T10:00:00.000Z",
                assignedToUser: { id: "user-1", username: "jane.doe" }
              }
            ],
            meta: { total: 1, page: 1, perPage: 20 }
          }
        });
      }
      if (queryKey[0] === "assets" && queryKey[1] === "summary") {
        return createQueryResult({
          data: {
            total: 1,
            assigned: 1,
            unmatched: 0,
            lastSyncedAt: "2026-05-16T10:00:00.000Z",
            syncEnabled: true
          }
        });
      }
      if (queryKey[0] === "assets" && queryKey[1] === "meta") {
        return createQueryResult({ data: { statuses: ["Deployed"], categories: ["Laptops"] } });
      }
      return createQueryResult();
    });

    renderPage();

    expect(screen.getByRole("heading", { name: "Assets" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "JKS-100" })).toHaveAttribute("href", "/assets/asset-1");
    expect(screen.getByText("192.168.78.29")).toBeInTheDocument();
    expect(screen.getByText("B0:83:FE:6F:7D:0B")).toBeInTheDocument();
    expect(screen.queryByText(/synced value/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not provided/i)).not.toBeInTheDocument();
    expect(screen.queryByText("LAN")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sync now" })).not.toBeInTheDocument();
  });

  it("keeps asset inventory columns structured for network values", () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assets" && queryKey[1] === "list") {
        return createQueryResult({
          data: {
            data: [
              {
                id: "asset-1",
                assetTag: "JKS-100",
                modelName: "MacBook Pro",
                serial: "SN1",
                categoryName: "Laptops",
                statusLabel: "Deployed",
                ipAddress: "192.168.78.29",
                macAddressLan: "B083FE6F7D0B",
                assignmentSource: "auto_username",
                lastSyncedAt: "2026-05-16T10:00:00.000Z",
                assignedToUser: { id: "user-1", username: "jane.doe" }
              }
            ],
            meta: { total: 1, page: 1, perPage: 20 }
          }
        });
      }
      if (queryKey[0] === "assets" && queryKey[1] === "summary") {
        return createQueryResult({
          data: {
            total: 1,
            assigned: 1,
            unmatched: 0,
            lastSyncedAt: "2026-05-16T10:00:00.000Z",
            syncEnabled: true
          }
        });
      }
      if (queryKey[0] === "assets" && queryKey[1] === "meta") {
        return createQueryResult({ data: { statuses: ["Deployed"], categories: ["Laptops"] } });
      }
      return createQueryResult();
    });

    renderPage();

    const table = screen.getByRole("table", { name: "Asset inventory" });
    expect(table.querySelectorAll("col")).toHaveLength(10);
    expect(table.querySelector(".assets-table__col--mac")).toBeInTheDocument();

    expect(screen.getByText("192.168.78.29").closest("td")).toHaveClass("assets-ip-cell");
    expect(screen.getByText("B0:83:FE:6F:7D:0B").closest("td")).toHaveClass("assets-mac-cell");
  });

  it("shows sync control for IT users", () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assets" && queryKey[1] === "list") {
        return createQueryResult({
          data: { data: [], meta: { total: 0, page: 1, perPage: 20 } }
        });
      }
      if (queryKey[0] === "assets" && queryKey[1] === "summary") {
        return createQueryResult({
          data: { total: 0, assigned: 0, unmatched: 0, lastSyncedAt: null, syncEnabled: true }
        });
      }
      return createQueryResult({ data: { statuses: [], categories: [] } });
    });

    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <Outlet context={{ user: { ...sessionUser, role: "it" } }} />,
          children: [{ path: "assets", element: <AssetsListPage /> }]
        }
      ],
      { initialEntries: ["/assets"] }
    );

    render(<RouterProvider router={router} />);
    expect(screen.getByRole("button", { name: "Sync now" })).toBeInTheDocument();
  });
});
