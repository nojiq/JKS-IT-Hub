import { useMemo } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { IT_STAFF_ROLES } from "../../../shared/auth/workspaceRoles.js";
import { SearchInput } from "../../../shared/components/SearchInput/SearchInput.jsx";
import { FilterSelect } from "../../../shared/components/FilterPanel/FilterSelect.jsx";
import { SearchEmptyState } from "../../../shared/components/EmptyState/SearchEmptyState.jsx";
import { DataStateBlock } from "../../../shared/workspace/DataStateBlock.jsx";
import { WorkspacePageHeader } from "../../../shared/workspace/WorkspacePageHeader.jsx";
import { WorkspacePanel } from "../../../shared/workspace/WorkspacePanel.jsx";
import { useSharedFilters } from "../../../shared/workspace/useSharedFilters.js";
import {
  fetchAssetMeta,
  fetchAssets,
  fetchAssetSyncStatus,
  triggerAssetSync
} from "../api/assetsApi.js";
import { AssetSummaryStrip } from "../components/AssetSummaryStrip.jsx";
import { AssetTable } from "../components/AssetTable.jsx";
import {
  ASSIGNMENT_SOURCE_OPTIONS,
  buildCategoryFilterOptions,
  buildStatusFilterOptions
} from "../utils/assetDisplay.js";
import "../assets-workspace.css";

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

export default function AssetsListPage() {
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const canManage = IT_STAFF_ROLES.includes(user?.role);
  const filterContract = useSharedFilters({
    page: "1",
    perPage: "20",
    search: "",
    status: "",
    category: "",
    assignmentSource: ""
  });

  const listQuery = useQuery({
    queryKey: ["assets", "list", filterContract.filters],
    queryFn: () => fetchAssets(filterContract.filters),
    placeholderData: keepPreviousData
  });

  const metaQuery = useQuery({
    queryKey: ["assets", "meta"],
    queryFn: async () => {
      try {
        return await fetchAssetMeta();
      } catch {
        return { statuses: [], categories: [] };
      }
    },
    staleTime: 60_000
  });

  const summaryQueries = useQuery({
    queryKey: ["assets", "summary"],
    queryFn: async () => {
      const [totalRes, unmatchedRes, syncStatus] = await Promise.all([
        fetchAssets({ page: "1", perPage: "1" }),
        fetchAssets({ page: "1", perPage: "1", assignmentSource: "unmatched" }),
        fetchAssetSyncStatus()
      ]);

      let assigned = 0;
      try {
        const assignedRes = await fetchAssets({ page: "1", perPage: "1", linked: "true" });
        assigned = assignedRes.meta?.total ?? 0;
      } catch {
        const [autoUser, autoEmail, manual] = await Promise.all([
          fetchAssets({ page: "1", perPage: "1", assignmentSource: "auto_username" }),
          fetchAssets({ page: "1", perPage: "1", assignmentSource: "auto_email" }),
          fetchAssets({ page: "1", perPage: "1", assignmentSource: "manual" })
        ]);
        assigned =
          (autoUser.meta?.total ?? 0) +
          (autoEmail.meta?.total ?? 0) +
          (manual.meta?.total ?? 0);
      }

      const latestRun = syncStatus?.latestRun;
      const lastSyncedAt =
        latestRun?.status === "completed" ? latestRun.finishedAt ?? latestRun.startedAt : null;

      return {
        total: totalRes.meta?.total ?? 0,
        assigned,
        unmatched: unmatchedRes.meta?.total ?? 0,
        lastSyncedAt,
        syncEnabled: syncStatus?.enabled ?? false
      };
    },
    staleTime: 30_000
  });

  const syncMutation = useMutation({
    mutationFn: triggerAssetSync,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assets"] })
      ]);
    }
  });

  const assets = listQuery.data?.data ?? [];
  const totalResults = Number(listQuery.data?.meta?.total ?? 0);
  const currentPage = Math.max(1, Number(listQuery.data?.meta?.page ?? filterContract.filters.page ?? 1));
  const rowsPerPage = Math.max(1, Number(listQuery.data?.meta?.perPage ?? filterContract.filters.perPage ?? 20));
  const totalPages = Math.max(1, Math.ceil(totalResults / rowsPerPage));
  const showingFrom = totalResults > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0;
  const showingTo = totalResults > 0 ? Math.min(totalResults, currentPage * rowsPerPage) : 0;

  const statusOptions = useMemo(
    () => buildStatusFilterOptions(metaQuery.data?.statuses ?? []),
    [metaQuery.data?.statuses]
  );
  const categoryOptions = useMemo(
    () => buildCategoryFilterOptions(metaQuery.data?.categories ?? []),
    [metaQuery.data?.categories]
  );

  const setFilterAndResetPage = (key, value) => {
    filterContract.apply({
      ...filterContract.filters,
      [key]: value,
      page: "1"
    });
  };

  const hasActiveSearchOrFilters =
    Boolean(filterContract.filters.search) || filterContract.hasActiveFilters;

  if (listQuery.isLoading && !listQuery.data) {
    return (
      <section className="workspace-page assets-page">
        <DataStateBlock
          variant="loading"
          title="Loading assets"
          description="Fetching inventory from IT Hub."
        />
      </section>
    );
  }

  if (listQuery.error) {
    return (
      <section className="workspace-page assets-page">
        <DataStateBlock
          variant="error"
          title="Unable to load assets"
          description={listQuery.error.message}
          actionLabel="Retry"
          onAction={() => listQuery.refetch()}
        />
      </section>
    );
  }

  return (
    <section className="workspace-page assets-page">
      <WorkspacePageHeader
        eyebrow="Core Operations"
        title="Assets"
        description="Operational hardware inventory synced from Snipe-IT. Search, filter, and review assignments."
        actions={canManage ? (
          <button
            type="button"
            className="workspace-inline-button is-primary"
            disabled={syncMutation.isPending || summaryQueries.data?.syncEnabled === false}
            title={
              summaryQueries.data?.syncEnabled === false
                ? "Snipe-IT sync is not configured"
                : "Pull latest assets from Snipe-IT"
            }
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending ? "Syncing…" : "Sync now"}
          </button>
        ) : null}
      />

      <AssetSummaryStrip
        total={summaryQueries.data?.total ?? 0}
        assigned={summaryQueries.data?.assigned ?? 0}
        unmatched={summaryQueries.data?.unmatched ?? 0}
        lastSyncedAt={summaryQueries.data?.lastSyncedAt}
        isLoading={summaryQueries.isLoading}
      />

      {syncMutation.error ? (
        <p className="assets-feedback is-error" role="alert">
          {syncMutation.error.message}
        </p>
      ) : null}

      <WorkspacePanel
        variant="content"
        title="Inventory"
        meta="Filter by tag, serial, model, assignee, status, category, or assignment source."
        className="assets-inventory-panel"
      >
        <div className="assets-toolbar">
          <SearchInput
            value={filterContract.filters.search ?? ""}
            onChange={(value) => setFilterAndResetPage("search", value)}
            placeholder="Search tag, serial, model, or assignee"
            ariaLabel="Search assets"
          />
          <div className="assets-filter-row">
            <FilterSelect
              label="Status"
              value={filterContract.filters.status}
              onChange={(value) => setFilterAndResetPage("status", value)}
              options={statusOptions}
            />
            <FilterSelect
              label="Category"
              value={filterContract.filters.category}
              onChange={(value) => setFilterAndResetPage("category", value)}
              options={categoryOptions}
            />
            <FilterSelect
              label="Assignment"
              value={filterContract.filters.assignmentSource}
              onChange={(value) => setFilterAndResetPage("assignmentSource", value)}
              options={ASSIGNMENT_SOURCE_OPTIONS}
            />
          </div>
        </div>

        {assets.length ? (
          <>
            <AssetTable assets={assets} />
            <footer className="assets-table-footer">
              <p className="assets-results-meta">
                Showing {showingFrom}–{showingTo} of {totalResults}
              </p>
              <div className="assets-pagination">
                <label className="assets-rows-label" htmlFor="assets-per-page">
                  Rows
                  <select
                    id="assets-per-page"
                    className="assets-filter-input assets-rows-select"
                    value={String(rowsPerPage)}
                    onChange={(event) =>
                      filterContract.apply({
                        ...filterContract.filters,
                        perPage: event.target.value,
                        page: "1"
                      })
                    }
                  >
                    {ROWS_PER_PAGE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="workspace-inline-button"
                  disabled={currentPage <= 1}
                  onClick={() => filterContract.setFilter("page", String(currentPage - 1))}
                >
                  Previous
                </button>
                <span className="assets-page-indicator">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="workspace-inline-button"
                  disabled={currentPage >= totalPages}
                  onClick={() => filterContract.setFilter("page", String(currentPage + 1))}
                >
                  Next
                </button>
              </div>
            </footer>
          </>
        ) : (
          <SearchEmptyState
            title={hasActiveSearchOrFilters ? "No assets match your filters" : "No assets in inventory yet"}
            description={
              hasActiveSearchOrFilters
                ? "Try clearing filters or broadening your search."
                : canManage
                  ? "Run a Snipe-IT sync to populate the inventory."
                  : "Assets will appear here after the next scheduled sync."
            }
            onClear={hasActiveSearchOrFilters ? filterContract.reset : undefined}
          />
        )}
      </WorkspacePanel>
    </section>
  );
}
