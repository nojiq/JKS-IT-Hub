import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SearchInput } from "../../../shared/components/SearchInput/SearchInput.jsx";
import { EmptyState } from "../../../shared/components/EmptyState/EmptyState.jsx";
import { DataStateBlock } from "../../../shared/workspace/DataStateBlock.jsx";
import { WorkspacePageHeader } from "../../../shared/workspace/WorkspacePageHeader.jsx";
import { WorkspacePanel } from "../../../shared/workspace/WorkspacePanel.jsx";
import { useSharedFilters } from "../../../shared/workspace/useSharedFilters.js";
import {
  createManualIpRecord,
  fetchIpInventory,
  fetchSubnetRules
} from "../api/ipListApi.js";
import { IpDetailDrawer } from "../components/IpDetailDrawer.jsx";
import { IpInventoryTable } from "../components/IpInventoryTable.jsx";
import { IpListSummaryStrip } from "../components/IpListSummaryStrip.jsx";
import { ManualIpForm } from "../components/ManualIpForm.jsx";
import { SourcePillToggle } from "../components/SourcePillToggle.jsx";
import { SubnetFilterCombobox } from "../components/SubnetFilterCombobox.jsx";
import {
  UNMAPPED_SUBNET_ID,
  buildSubnetComboboxOptions,
  formatSlash24Label,
  getSubnetLabel,
  getSubnetPurposeLabel,
  ipv4ToSlash24Prefix,
  resolveSubnetFilterForRow,
  rowMatchesIpPrefix
} from "../utils/ipListDisplay.js";
import "../ip-list-workspace.css";

const FOCUS_PARAM = "focus";

export default function IpListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const filterContract = useSharedFilters({
    search: "",
    source: "",
    subnetId: "",
    ipPrefix: ""
  });

  const focusIp = searchParams.get(FOCUS_PARAM) ?? "";
  const activeSubnetId = filterContract.filters.subnetId ?? "";
  const activeIpPrefix = filterContract.filters.ipPrefix ?? "";
  const [previewRow, setPreviewRow] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [duplicateError, setDuplicateError] = useState(null);
  const [createErrorMessage, setCreateErrorMessage] = useState("");

  const countFilters = useMemo(() => {
    const out = {};
    if (filterContract.filters.search) out.search = filterContract.filters.search;
    if (filterContract.filters.source) out.source = filterContract.filters.source;
    return out;
  }, [filterContract.filters.search, filterContract.filters.source]);

  const inventoryFilters = useMemo(() => {
    const out = { ...countFilters };
    if (activeSubnetId && activeSubnetId !== UNMAPPED_SUBNET_ID) {
      out.subnetId = activeSubnetId;
    }
    return out;
  }, [countFilters, activeSubnetId]);

  const inventoryQuery = useQuery({
    queryKey: ["ip-list", "inventory", inventoryFilters],
    queryFn: () => fetchIpInventory(inventoryFilters)
  });

  const navCountsQuery = useQuery({
    queryKey: ["ip-list", "inventory", "subnet-nav", countFilters],
    queryFn: () => fetchIpInventory(countFilters),
    staleTime: 30_000
  });

  const subnetsQuery = useQuery({
    queryKey: ["ip-list", "subnets"],
    queryFn: fetchSubnetRules,
    staleTime: 60_000
  });

  const createMutation = useMutation({
    mutationFn: (body) => createManualIpRecord(body),
    onSuccess: async (record) => {
      setShowCreate(false);
      setDuplicateError(null);
      setCreateErrorMessage("");
      await queryClient.invalidateQueries({ queryKey: ["ip-list"] });
      if (record?.ipAddress) {
        openDrawer(record.ipAddress, record);
      }
    },
    onError: (error) => {
      if (error.status === 409 || error.existing || error.redirectTo) {
        setDuplicateError({
          existing: error.existing ?? null,
          redirectTo: error.redirectTo ?? null,
          message: error.message
        });
        setCreateErrorMessage("");
      } else {
        setDuplicateError(null);
        setCreateErrorMessage(error.message || "Unable to create manual IP record.");
      }
    }
  });

  const subnetRules = subnetsQuery.data ?? [];
  const rawRows = inventoryQuery.data?.rows ?? [];
  const rows = useMemo(() => {
    let result = rawRows;
    if (activeSubnetId === UNMAPPED_SUBNET_ID) {
      result = result.filter((row) => !row.subnet);
    }
    if (activeIpPrefix) {
      result = result.filter((row) => rowMatchesIpPrefix(row, activeIpPrefix));
    }
    return result;
  }, [rawRows, activeSubnetId, activeIpPrefix]);

  const groups = useMemo(() => {
    if (activeIpPrefix) {
      if (!rows.length) return [];
      return [{ subnet: null, purpose: formatSlash24Label(activeIpPrefix), count: rows.length }];
    }
    if (activeSubnetId === UNMAPPED_SUBNET_ID) {
      if (!rows.length) return [];
      return [{ subnet: null, purpose: "Unmapped", count: rows.length }];
    }
    return (inventoryQuery.data?.groups ?? []).filter((group) => group.count > 0);
  }, [inventoryQuery.data?.groups, activeSubnetId, activeIpPrefix, rows.length]);

  const assetCount = rows.filter((row) => row.source === "asset").length;
  const manualCount = rows.filter((row) => row.source === "manual").length;
  const mappedSubnetCount = groups.filter((group) => group.subnet).length;

  const comboboxOptions = useMemo(
    () =>
      buildSubnetComboboxOptions(
        navCountsQuery.data?.rows ?? [],
        subnetRules,
        navCountsQuery.data?.groups ?? []
      ),
    [navCountsQuery.data, subnetRules]
  );

  const subnetSelection = useMemo(() => {
    if (activeIpPrefix) return { kind: "prefix", value: activeIpPrefix };
    if (activeSubnetId === UNMAPPED_SUBNET_ID) {
      return { kind: "unmapped", value: UNMAPPED_SUBNET_ID };
    }
    if (activeSubnetId) return { kind: "rule", value: activeSubnetId };
    return { kind: "all", value: "" };
  }, [activeSubnetId, activeIpPrefix]);

  const rowsBySubnet = useMemo(() => {
    const buckets = new Map();
    for (const row of rows) {
      const key = row.subnet?.id ?? UNMAPPED_SUBNET_ID;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(row);
    }
    return buckets;
  }, [rows]);

  const activeSubnetRule =
    activeSubnetId && activeSubnetId !== UNMAPPED_SUBNET_ID
      ? subnetRules.find((rule) => rule.id === activeSubnetId)
      : null;

  const activeSubnetLabel = activeIpPrefix
    ? formatSlash24Label(activeIpPrefix)
    : activeSubnetId === UNMAPPED_SUBNET_ID
      ? "Unmapped"
      : activeSubnetRule
        ? getSubnetLabel(activeSubnetRule)
        : null;

  const hasSubnetScope = Boolean(activeSubnetLabel);

  const showGroupedTables = !activeIpPrefix && groups.some((group) => group.subnet);

  const setFilter = (key, value) => {
    filterContract.apply({ ...filterContract.filters, [key]: value });
  };

  const clearSubnetFilters = () => {
    filterContract.apply({
      ...filterContract.filters,
      subnetId: "",
      ipPrefix: ""
    });
  };

  const handleSubnetSelectOption = (option) => {
    const next = {
      ...filterContract.filters,
      subnetId: "",
      ipPrefix: ""
    };
    if (option.kind === "rule") next.subnetId = option.value;
    else if (option.kind === "unmapped") next.subnetId = UNMAPPED_SUBNET_ID;
    else if (option.kind === "prefix") next.ipPrefix = option.value;
    filterContract.apply(next);
  };

  const handleSubnetSelectById = (subnetId) => {
    if (!subnetId) {
      handleSubnetSelectOption({ kind: "all", value: "" });
      return;
    }
    if (subnetId === UNMAPPED_SUBNET_ID) {
      handleSubnetSelectOption({ kind: "unmapped", value: UNMAPPED_SUBNET_ID });
      return;
    }
    handleSubnetSelectOption({ kind: "rule", value: subnetId });
  };

  const hasActiveSearchOrFilters =
    Boolean(filterContract.filters.search) || filterContract.hasActiveFilters;

  const isFirstRun =
    !inventoryQuery.isLoading &&
    !subnetsQuery.isLoading &&
    subnetRules.length === 0 &&
    (navCountsQuery.data?.rows?.length ?? 0) === 0 &&
    !hasActiveSearchOrFilters;

  const openDrawer = useCallback(
    (ipAddress, row = null) => {
      setPreviewRow(row);
      const next = new URLSearchParams(searchParams);
      next.set(FOCUS_PARAM, ipAddress);
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams]
  );

  const closeDrawer = useCallback(() => {
    setPreviewRow(null);
    const next = new URLSearchParams(searchParams);
    next.delete(FOCUS_PARAM);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleDuplicateNavigate = (info) => {
    const ip = info?.existing?.ipAddress;
    const target = info?.redirectTo
      || (ip ? `/ip-list/${encodeURIComponent(ip)}` : null);
    if (target) {
      setShowCreate(false);
      setDuplicateError(null);
      if (target.startsWith("/ip-list/") && !target.includes("/subnets")) {
        const ipFromPath = decodeURIComponent(target.replace(/^\/ip-list\//, ""));
        openDrawer(ipFromPath);
      } else {
        navigate(target);
      }
    }
  };

  const handleSubnetFilterFromRow = (row) => {
    if (row?.subnet?.id) {
      handleSubnetSelectOption({ kind: "rule", value: row.subnet.id });
      return;
    }
    const prefix = ipv4ToSlash24Prefix(row?.ipAddress);
    if (prefix) {
      handleSubnetSelectOption({ kind: "prefix", value: prefix });
      return;
    }
    handleSubnetSelectOption({ kind: "unmapped", value: UNMAPPED_SUBNET_ID });
  };

  const tableHandlers = {
    onRowOpen: (row) => openDrawer(row.ipAddress, row),
    onRowNavigate: (row) => navigate(`/ip-list/${encodeURIComponent(row.ipAddress)}`),
    onSubnetFilter: handleSubnetFilterFromRow
  };

  if (inventoryQuery.isLoading && !inventoryQuery.data) {
    return (
      <section className="workspace-page ip-list-page">
        <DataStateBlock
          variant="loading"
          title="Loading IP inventory"
          description="Fetching known IPs from IT Hub."
        />
      </section>
    );
  }

  if (inventoryQuery.error) {
    return (
      <section className="workspace-page ip-list-page">
        <DataStateBlock
          variant="error"
          title="Unable to load IP inventory"
          description={inventoryQuery.error.message}
          actionLabel="Retry"
          onAction={() => inventoryQuery.refetch()}
        />
      </section>
    );
  }

  return (
    <section className="workspace-page ip-list-page">
      <WorkspacePageHeader
        eyebrow="Core Operations"
        title="IP List"
        description="Practical IP inventory: who owns which IP, on which subnet purpose, host, and device."
        actions={(
          <button
            type="button"
            className="workspace-inline-button is-primary"
            onClick={() => {
              setShowCreate((value) => !value);
              setDuplicateError(null);
              setCreateErrorMessage("");
            }}
          >
            {showCreate ? "Close form" : "Add manual IP"}
          </button>
        )}
      />

      <IpListSummaryStrip
        total={rows.length}
        assetCount={assetCount}
        manualCount={manualCount}
        subnetCount={mappedSubnetCount}
        isLoading={inventoryQuery.isFetching && !inventoryQuery.data}
      />

      {showCreate ? (
        <WorkspacePanel variant="content" className="ip-list-form-panel" title="New manual IP">
          <ManualIpForm
            mode="create"
            submitting={createMutation.isPending}
            errorMessage={createErrorMessage}
            duplicateError={duplicateError}
            onSubmit={(body) => createMutation.mutate(body)}
            onCancel={() => {
              setShowCreate(false);
              setDuplicateError(null);
              setCreateErrorMessage("");
            }}
            onNavigateDuplicate={handleDuplicateNavigate}
          />
        </WorkspacePanel>
      ) : null}

      <WorkspacePanel
        variant="content"
        title="Known IPs"
        meta="Only IPs sourced from assets or manually recorded. Empty hosts are not shown."
        className="ip-list-inventory-panel"
      >
        <div className="ip-list-inventory-main">
          <div className="ip-list-toolbar">
            <SearchInput
              value={filterContract.filters.search ?? ""}
              onChange={(value) => setFilter("search", value)}
              placeholder="Search IP, hostname, purpose, MAC"
            />
            <SubnetFilterCombobox
              comboboxOptions={comboboxOptions}
              selection={subnetSelection}
              onSelect={handleSubnetSelectOption}
              isLoading={navCountsQuery.isFetching && !navCountsQuery.data}
            />
            <SourcePillToggle
              value={filterContract.filters.source ?? ""}
              onChange={(value) => setFilter("source", value)}
            />
          </div>

          {hasSubnetScope ? (
            <p className="ip-list-subnet-context">
              Showing <strong>{rows.length}</strong> known IP{rows.length === 1 ? "" : "s"} in{" "}
              <strong>{activeSubnetLabel}</strong>
              {activeIpPrefix ? (
                <> (<code>{activeIpPrefix}.0/24</code>)</>
              ) : activeSubnetId !== UNMAPPED_SUBNET_ID && activeSubnetRule?.cidr ? (
                <> (<code>{activeSubnetRule.cidr}</code>)</>
              ) : null}
              .{" "}
              {activeIpPrefix ? (
                <>
                  <Link className="ip-list-subnet-context__link" to="/ip-list/subnets">
                    Save as subnet rule
                  </Link>
                  {" · "}
                </>
              ) : null}
              <button
                type="button"
                className="ip-list-subnet-context__clear"
                onClick={clearSubnetFilters}
              >
                Show all subnets
              </button>
            </p>
          ) : null}

          {rows.length ? (
            showGroupedTables ? (
              <div className="ip-list-groups">
                {groups.map((group) => {
                  const groupKey = group.subnet?.id ?? UNMAPPED_SUBNET_ID;
                  const groupRows = rowsBySubnet.get(groupKey) ?? [];
                  if (!groupRows.length) return null;
                  return (
                    <section
                      key={groupKey}
                      className="ip-list-group"
                      aria-label={`Subnet group ${getSubnetLabel(group.subnet)}`}
                    >
                      <header className="ip-list-group__header">
                        <button
                          type="button"
                          className="ip-list-group__title-button"
                          onClick={() =>
                            handleSubnetSelectById(group.subnet?.id ?? UNMAPPED_SUBNET_ID)
                          }
                          title="Filter to this subnet"
                        >
                          <span className="ip-list-group__title">
                            {getSubnetLabel(group.subnet)}
                          </span>
                          <FilterChevronIcon />
                        </button>
                        <span className="ip-list-group__count">
                          {group.count} IP{group.count === 1 ? "" : "s"}
                        </span>
                      </header>
                      <IpInventoryTable
                        rows={groupRows}
                        ariaLabel={`IP inventory · ${group.purpose}`}
                        {...tableHandlers}
                      />
                    </section>
                  );
                })}
              </div>
            ) : (
              <IpInventoryTable rows={rows} {...tableHandlers} />
            )
          ) : isFirstRun ? (
            <EmptyState
              title="No IPs or subnet rules yet"
              description="Start by defining a subnet (e.g. 192.168.78.0/24, purpose Server) so future IPs group correctly."
              action={(
                <Link className="workspace-inline-button is-primary" to="/ip-list/subnets">
                  Add first subnet
                </Link>
              )}
            />
          ) : (
            <EmptyState
              title={
                activeSubnetId === UNMAPPED_SUBNET_ID
                  ? "No unmapped IPs"
                  : activeIpPrefix
                    ? `No IPs in ${formatSlash24Label(activeIpPrefix)}`
                    : activeSubnetLabel
                      ? `No IPs in ${getSubnetPurposeLabel(activeSubnetRule)}`
                      : hasActiveSearchOrFilters
                        ? "No IPs match your filters"
                        : "No known IPs yet"
              }
              description={
                activeSubnetId === UNMAPPED_SUBNET_ID
                  ? "Every known IP matches a subnet rule, or try clearing search and source filters."
                  : activeIpPrefix
                    ? "Try a different network prefix or save this range as a subnet rule."
                    : activeSubnetLabel
                      ? "Add a manual IP in this range or wait for an asset sync with a matching address."
                      : hasActiveSearchOrFilters
                        ? "Try clearing filters or broadening your search."
                        : "Add a manual IP or wait for an asset sync that includes IP addresses."
              }
              action={
                hasActiveSearchOrFilters || hasSubnetScope ? (
                  <button
                    type="button"
                    className="empty-state-action"
                    onClick={() => {
                      if (hasSubnetScope) clearSubnetFilters();
                      else filterContract.reset();
                    }}
                  >
                    {hasSubnetScope ? "Show all subnets" : "Clear filters"}
                  </button>
                ) : null
              }
            />
          )}
        </div>
      </WorkspacePanel>

      {focusIp ? (
        <IpDetailDrawer ipAddress={focusIp} previewRow={previewRow} onClose={closeDrawer} />
      ) : null}
    </section>
  );
}

function FilterChevronIcon() {
  return (
    <svg className="ip-list-group__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
