import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/features/ip-list/api/ipListApi.js", () => ({
  fetchSubnetRules: vi.fn(),
  createSubnetRule: vi.fn(),
  updateSubnetRule: vi.fn(),
  deleteSubnetRule: vi.fn()
}));

import SubnetsPage from "../src/features/ip-list/pages/SubnetsPage.jsx";
import { fetchSubnetRules } from "../src/features/ip-list/api/ipListApi.js";

const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

describe("SubnetsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSubnetRules.mockResolvedValue([]);
  });

  it("renders subnet manager and back link to IP list", async () => {
    const router = createMemoryRouter(
      [
        { path: "/ip-list", element: <div>List</div> },
        { path: "/ip-list/subnets", element: <SubnetsPage /> }
      ],
      { initialEntries: ["/ip-list/subnets"] }
    );

    render(
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    expect(await screen.findByRole("heading", { name: "Subnet rules", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to IP list/i })).toHaveAttribute("href", "/ip-list");
    expect(screen.getByRole("heading", { name: "Subnet rules", level: 3 })).toBeInTheDocument();
  });
});
