import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import UserDetailPage from "../src/features/users/user-detail-page.jsx";
import { fetchSession } from "../src/features/users/auth-api.js";
import { fetchUserDetail, fetchUserHistory, updateUserProfileFields } from "../src/features/users/users-api.js";

vi.mock("../src/features/users/auth-api.js", () => ({
  fetchSession: vi.fn()
}));

vi.mock("../src/features/users/users-api.js", () => ({
  fetchUserDetail: vi.fn(),
  fetchUserHistory: vi.fn(),
  updateUserStatus: vi.fn(),
  updateUserProfileFields: vi.fn()
}));

vi.mock("../src/features/credentials/hooks/useCredentials.js", () => ({
  useInitiateRegeneration: () => ({ mutateAsync: vi.fn() }),
  useConfirmRegeneration: () => ({ mutateAsync: vi.fn() }),
  useUnlockCredential: () => ({ mutateAsync: vi.fn() }),
  useUserCredentials: () => ({
    data: { data: [] },
    isLoading: false,
    error: null,
    refetch: vi.fn()
  })
}));

vi.mock("../src/features/credentials/regeneration", () => ({
  CredentialRegeneration: () => <div data-testid="credential-regeneration" />
}));

vi.mock("../src/features/credentials/components/CredentialList.jsx", () => ({
  default: () => <div data-testid="credential-list" />
}));

vi.mock("../src/features/credentials/components/DisabledUserBanner.jsx", () => ({
  default: () => null
}));

vi.mock("../src/features/credentials/generation/CredentialGenerator.jsx", () => ({
  default: () => <div data-testid="credential-generator" />
}));

vi.mock("../src/features/exports/components/CredentialExportButton.jsx", () => ({
  CredentialExportButton: () => <button type="button">Export</button>
}));

const renderUserDetail = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/users/user-1"]}>
        <Routes>
          <Route path="/users/:id" element={<UserDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("User profile fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSession.mockResolvedValue({
      user: { id: "it-1", username: "it-user", role: "it", status: "active" }
    });
    fetchUserHistory.mockResolvedValue([]);
    fetchUserDetail.mockResolvedValue({
      fields: ["cn", "mail"],
      user: {
        id: "user-1",
        username: "abdullah.fauzi",
        role: "requester",
        status: "active",
        ldapSyncedAt: "2026-05-12T04:00:00.000Z",
        ldapFields: {
          cn: "Abdullah Fauzi",
          mail: "abdullah.fauzi@jkseng.com"
        },
        profileFields: [
          {
            key: "name",
            label: "Name",
            type: "text",
            required: true,
            sensitive: false,
            value: "Abdullah Fauzi",
            source: "manual"
          },
          {
            key: "actual-password",
            label: "Actual Password",
            type: "password",
            required: false,
            sensitive: true,
            value: "Secret123!",
            source: "manual"
          },
          {
            key: "remarks",
            label: "Remarks",
            type: "textarea",
            required: false,
            sensitive: false,
            value: "",
            source: null
          }
        ]
      }
    });
    updateUserProfileFields.mockResolvedValue({
      profileFields: [
        {
          key: "name",
          label: "Name",
          type: "text",
          required: true,
          sensitive: false,
          value: "Abdullah Updated",
          source: "manual"
        }
      ]
    });
  });

  it("shows an edit button for IT users and saves dynamic profile field values", async () => {
    renderUserDetail();

    const editButton = await screen.findByRole("button", { name: "Edit profile fields" });
    expect(editButton).toBeInTheDocument();
    expect(screen.getAllByText("Source: Manual").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Source: LDAP").length).toBeGreaterThan(0);
    expect(screen.getByText("Secret123!")).toBeInTheDocument();
    expect(screen.queryByText("********")).not.toBeInTheDocument();

    fireEvent.click(editButton);

    const nameInput = screen.getByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.change(nameInput, { target: { value: "Abdullah Updated" } });

    fireEvent.click(screen.getByRole("button", { name: "Save profile fields" }));

    await waitFor(() => {
      expect(updateUserProfileFields).toHaveBeenCalledWith("user-1", {
        name: "Abdullah Updated",
        "actual-password": "Secret123!",
        remarks: ""
      });
    });
  });

  it("hides the edit button for requester users", async () => {
    fetchSession.mockResolvedValue({
      user: { id: "requester-1", username: "requester", role: "requester", status: "active" }
    });

    renderUserDetail();

    await screen.findByRole("heading", { name: "abdullah.fauzi" });
    expect(screen.queryByRole("button", { name: "Edit profile fields" })).not.toBeInTheDocument();
    expect(screen.getByText("********")).toBeInTheDocument();
    expect(screen.queryByText("Secret123!")).not.toBeInTheDocument();
  });
});
