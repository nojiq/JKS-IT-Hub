import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext } from "react-router-dom";
import { fetchUsers } from "./users-api.js";
import { BatchCredentialExportButton } from "../exports/components/BatchCredentialExportButton.jsx";
import LdapSyncPanel from "./ldap-sync-panel.jsx";

import { SearchInput } from "../../shared/components/SearchInput/SearchInput";
import { FilterSelect } from "../../shared/components/FilterPanel/FilterSelect";
import { SearchEmptyState } from "../../shared/components/EmptyState/SearchEmptyState";
import { WorkspacePageHeader } from "../../shared/workspace/WorkspacePageHeader";
import { BulkActionsBar } from "../../shared/workspace/BulkActionsBar";
import { DataStateBlock } from "../../shared/workspace/DataStateBlock";
import { useSharedFilters } from "../../shared/workspace/useSharedFilters";
import { useIsMobile } from "../../shared/hooks/useMediaQuery";
import "../../shared/workspace/workspace.css";

const IT_ROLES = ["it", "admin", "head_it"];
const EMPTY_USERS = [];
const EMPTY_FIELDS = [];
const EMPTY_META = {};
const EMPTY_PAYLOAD = { users: EMPTY_USERS, fields: EMPTY_FIELDS, meta: EMPTY_META };
const ROLE_LABELS = {
  requester: "Requester",
  it: "IT Support",
  admin: "Administrator",
  head_it: "Head of IT"
};
const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "-";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
};

const normalizeScalar = (value) => {
  if (Array.isArray(value)) {
    const firstFilled = value.find((item) => item !== null && item !== undefined && item !== "");
    return firstFilled === undefined ? "" : String(firstFilled).trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
};

const toHumanLabel = (value) => {
  const clean = normalizeScalar(value);
  if (!clean) {
    return "-";
  }

  return clean
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getLdapValue = (ldapFields, candidates = []) => {
  if (!ldapFields || typeof ldapFields !== "object") {
    return "";
  }

  const entries = Object.entries(ldapFields);

  for (const candidate of candidates) {
    const directValue = ldapFields[candidate];
    if (directValue !== undefined && directValue !== null && directValue !== "") {
      return directValue;
    }

    const lowerCandidate = String(candidate).toLowerCase();
    const match = entries.find(([key]) => key.toLowerCase() === lowerCandidate);
    if (match && match[1] !== undefined && match[1] !== null && match[1] !== "") {
      return match[1];
    }
  }

  return "";
};

const getAvatarSource = (ldapFields) => {
  const rawValue = normalizeScalar(
    getLdapValue(ldapFields, ["avatar", "avatarUrl", "thumbnailphoto", "jpegphoto", "photo"])
  );

  if (!rawValue) {
    return "";
  }

  if (rawValue.startsWith("http://") || rawValue.startsWith("https://") || rawValue.startsWith("data:")) {
    return rawValue;
  }

  if (/^[a-z0-9+/=\s]+$/i.test(rawValue) && rawValue.length > 48) {
    return `data:image/jpeg;base64,${rawValue.replace(/\s+/g, "")}`;
  }

  return "";
};

const getInitials = (name, fallback = "U") => {
  const source = normalizeScalar(name) || normalizeScalar(fallback) || "U";
  const parts = source.split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "U";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const buildUserProfile = (entry) => {
  const ldapFields = entry.ldapFields ?? {};
  const givenName = normalizeScalar(getLdapValue(ldapFields, ["givenname", "givenName", "firstName"]));
  const surname = normalizeScalar(getLdapValue(ldapFields, ["sn", "surname", "lastName"]));
  const displayName =
    [givenName, surname].filter(Boolean).join(" ") ||
    normalizeScalar(getLdapValue(ldapFields, ["displayname", "cn", "name"])) ||
    entry.username ||
    "-";
  const mail = normalizeScalar(getLdapValue(ldapFields, ["mail", "email", "userprincipalname"])) || "-";
  const samAccountName =
    normalizeScalar(getLdapValue(ldapFields, ["samaccountname", "samAccountName", "uid"])) ||
    normalizeScalar(entry.username) ||
    "-";
  const department = normalizeScalar(getLdapValue(ldapFields, ["department", "dept"])) || "-";
  const status = normalizeScalar(entry.status).toLowerCase();
  const isActive = status === "active";

  return {
    avatarSrc: getAvatarSource(ldapFields),
    initials: getInitials(displayName, entry.username),
    displayName,
    mail,
    samAccountName,
    department,
    roleLabel: ROLE_LABELS[entry.role] || toHumanLabel(entry.role),
    statusLabel: isActive ? "Active" : "Inactive",
    statusClassName: isActive ? "is-active" : "is-inactive"
  };
};

export default function UsersListPage() {
  const { user } = useOutletContext() ?? {};
  const isMobile = useIsMobile();
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const filterContract = useSharedFilters({ page: "1", perPage: "20" });

  const usersQuery = useQuery({
    queryKey: ["users", filterContract.filters],
    queryFn: () => fetchUsers(filterContract.filters),
    keepPreviousData: true
  });

  const payload = usersQuery.data ?? EMPTY_PAYLOAD;
  const users = payload.users ?? EMPTY_USERS;
  const fields = payload.fields ?? EMPTY_FIELDS;
  const uniqueFields = useMemo(() => [...new Set(fields)], [fields]);
  const hasSync = users.some((entry) => Boolean(entry.ldapSyncedAt));
  const isItUser = IT_ROLES.includes(user?.role);
  const allUsersSelected = users.length > 0 && selectedUsers.size === users.length;
  const totalResults = Number(payload.meta?.total ?? users.length ?? 0);
  const currentPage = Math.max(1, Number(payload.meta?.page ?? filterContract.filters.page ?? 1));
  const rowsPerPage = Math.max(1, Number(payload.meta?.perPage ?? filterContract.filters.perPage ?? 20));
  const totalPages = Math.max(1, Math.ceil(totalResults / rowsPerPage));
  const showingFrom = totalResults > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0;
  const showingTo = totalResults > 0 ? Math.min(totalResults, currentPage * rowsPerPage) : 0;

  useEffect(() => {
    setSelectedUsers((previous) => {
      const allowedIds = new Set(users.map((entry) => entry.id));
      const nextIds = [...previous].filter((id) => allowedIds.has(id));
      if (nextIds.length === previous.size && nextIds.every((id) => previous.has(id))) {
        return previous;
      }
      return new Set(nextIds);
    });
  }, [users]);

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedUsers(new Set(users.map((entry) => entry.id)));
      return;
    }

    setSelectedUsers(new Set());
  };

  const toggleSelectAllUsers = () => {
    if (allUsersSelected) {
      setSelectedUsers(new Set());
      return;
    }
    setSelectedUsers(new Set(users.map((entry) => entry.id)));
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers((previous) => {
      const next = new Set(previous);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const setFilterAndResetPage = (key, value) => {
    filterContract.apply({
      ...filterContract.filters,
      [key]: value,
      page: "1"
    });
  };

  const handleRowsPerPageChange = (value) => {
    filterContract.apply({
      ...filterContract.filters,
      perPage: value,
      page: "1"
    });
  };

  const goToPage = (page) => {
    filterContract.setFilter("page", String(page));
  };

  if (usersQuery.isLoading && !usersQuery.data) {
    return (
      <section className="workspace-page">
        <DataStateBlock
          variant="loading"
          title="Loading users"
          description="Fetching directory data."
        />
      </section>
    );
  }

  if (usersQuery.error) {
    return (
      <section className="workspace-page">
        <DataStateBlock
          variant="error"
          title="Unable to load users"
          description={usersQuery.error.message}
          actionLabel="Retry"
          onAction={() => usersQuery.refetch()}
        />
      </section>
    );
  }

  return (
    <section className="workspace-page users-page">
      <WorkspacePageHeader
        eyebrow="Directory"
        title="Users"
        description="Read-only LDAP profile data synced into IT-Hub."
        meta={payload.meta?.total ? `${payload.meta.total} users` : "User directory"}
      />

      <section className="dashboard-sync-panel users-sync-panel">
        <h3>LDAP Synchronization</h3>
        <p className="dashboard-summary-text">
          Run directory sync here before reviewing user records or credential data.
        </p>
        <LdapSyncPanel />
      </section>

      <div className="users-table-toolbar">
        <div className="users-toolbar-search">
          <SearchInput
            value={filterContract.filters.search || ""}
            onChange={(value) => setFilterAndResetPage("search", value)}
            placeholder="Search by name, username or department..."
            isLoading={usersQuery.isFetching}
          />
        </div>

        <FilterSelect
          label="Role"
          value={filterContract.filters.role}
          onChange={(value) => setFilterAndResetPage("role", value)}
          options={[
            { value: "requester", label: "Requester" },
            { value: "it", label: "IT Support" },
            { value: "admin", label: "Administrator" },
            { value: "head_it", label: "Head of IT" }
          ]}
        />
        <FilterSelect
          label="Status"
          value={filterContract.filters.status}
          onChange={(value) => setFilterAndResetPage("status", value)}
          options={[
            { value: "active", label: "Active" },
            { value: "disabled", label: "Disabled" }
          ]}
        />

        <button
          type="button"
          className="workspace-inline-button users-export-button"
          disabled
          title="CSV export will be available soon"
        >
          Export CSV
        </button>
      </div>

      {isItUser ? (
        <BulkActionsBar selectedCount={selectedUsers.size}>
          <BatchCredentialExportButton userIds={Array.from(selectedUsers)} />
          <button
            type="button"
            className="workspace-inline-button"
            onClick={() => setSelectedUsers(new Set())}
          >
            Clear Selection
          </button>
        </BulkActionsBar>
      ) : null}

      {!hasSync && !filterContract.hasActiveFilters && !filterContract.filters.search ? (
        <div className="users-alert">
          <p className="users-alert-title">LDAP sync has not run yet.</p>
          <p className="users-alert-text">
            Run manual sync first to populate directory fields.
            <Link className="users-alert-link" to="/users">
              Go to sync panel
            </Link>
          </p>
        </div>
      ) : null}

      {users.length ? (
        isMobile ? (
          <div className="users-mobile-list" role="list" aria-label="Users list">
            {isItUser ? (
              <div className="users-mobile-selection-bar">
                <button
                  type="button"
                  className="workspace-inline-button"
                  onClick={toggleSelectAllUsers}
                >
                  {allUsersSelected ? "Clear all selections" : "Select all users"}
                </button>
              </div>
            ) : null}

            {users.map((entry) => {
              const userProfile = buildUserProfile(entry);
              return (
                <article
                  className={`users-mobile-card${selectedUsers.has(entry.id) ? " is-selected" : ""}`}
                  key={entry.id}
                  role="listitem"
                >
                  <div className="users-mobile-card-header">
                    {isItUser ? (
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(entry.id)}
                        onChange={() => handleSelectUser(entry.id)}
                        aria-label={`Select ${entry.username}`}
                      />
                    ) : null}

                    <div>
                      <Link className="users-name" to={`/users/${entry.id}`}>
                        {userProfile.displayName}
                      </Link>
                      <span className="users-meta">{userProfile.mail}</span>
                    </div>
                  </div>

                  <dl className="users-mobile-field-grid">
                    <div className="users-mobile-field-row">
                      <dt>Role</dt>
                      <dd>{userProfile.roleLabel}</dd>
                    </div>
                    <div className="users-mobile-field-row">
                      <dt>Status</dt>
                      <dd>
                        <span className={`users-status-badge ${userProfile.statusClassName}`}>
                          {userProfile.statusLabel}
                        </span>
                      </dd>
                    </div>
                    <div className="users-mobile-field-row">
                      <dt>Username</dt>
                      <dd>{userProfile.samAccountName}</dd>
                    </div>
                    <div className="users-mobile-field-row">
                      <dt>Department</dt>
                      <dd>{userProfile.department}</dd>
                    </div>
                    {uniqueFields.map((field) => (
                      <div className="users-mobile-field-row" key={field}>
                        <dt>{field}</dt>
                        <dd>{formatValue(entry.ldapFields?.[field])}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="users-management-card">
            <div className="workspace-table-container users-table-container">
              <table className="workspace-table users-management-table">
                <thead>
                  <tr>
                    {isItUser ? (
                      <th className="users-table-selection-cell">
                        <input
                          type="checkbox"
                          checked={allUsersSelected}
                          onChange={handleSelectAll}
                          aria-label="Select all users"
                        />
                      </th>
                    ) : null}
                    <th data-column="user">User</th>
                    <th data-column="role">Role</th>
                    <th data-column="status">Status</th>
                    <th data-column="username">Username</th>
                    <th data-column="department">Department</th>
                    <th data-column="actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((entry) => {
                    const userProfile = buildUserProfile(entry);
                    return (
                      <tr
                        key={entry.id}
                        className={selectedUsers.has(entry.id) ? "workspace-table-row-selected" : ""}
                      >
                        {isItUser ? (
                          <td className="users-table-selection-cell">
                            <input
                              type="checkbox"
                              checked={selectedUsers.has(entry.id)}
                              onChange={() => handleSelectUser(entry.id)}
                              aria-label={`Select ${entry.username}`}
                            />
                          </td>
                        ) : null}

                        <td data-column="user">
                          <div className="users-user-cell">
                            <div className="users-user-avatar" aria-hidden="true">
                              {userProfile.avatarSrc ? (
                                <img src={userProfile.avatarSrc} alt="" />
                              ) : (
                                <span>{userProfile.initials}</span>
                              )}
                            </div>

                            <div className="users-user-details">
                              <Link className="users-name" to={`/users/${entry.id}`}>
                                {userProfile.displayName}
                              </Link>
                              <span className="users-meta">{userProfile.mail}</span>
                            </div>
                          </div>
                        </td>

                        <td data-column="role">{userProfile.roleLabel}</td>
                        <td data-column="status">
                          <span className={`users-status-badge ${userProfile.statusClassName}`}>
                            {userProfile.statusLabel}
                          </span>
                        </td>
                        <td data-column="username">{userProfile.samAccountName}</td>
                        <td data-column="department">{userProfile.department}</td>
                        <td data-column="actions">
                          <Link className="workspace-inline-button users-row-action" to={`/users/${entry.id}`}>
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="users-pagination-bar">
              <p className="users-pagination-summary">
                Showing {showingFrom}-{showingTo} of {totalResults} results
              </p>

              <div className="users-pagination-controls">
                <label className="users-rows-per-page">
                  <span>Rows per page</span>
                  <select
                    value={String(rowsPerPage)}
                    onChange={(event) => handleRowsPerPageChange(event.target.value)}
                  >
                    {ROWS_PER_PAGE_OPTIONS.map((value) => (
                      <option key={value} value={String(value)}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                  className="workspace-inline-button"
                  type="button"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                  className="workspace-inline-button"
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )
      ) : filterContract.filters.search || filterContract.hasActiveFilters ? (
        <SearchEmptyState
          searchTerm={filterContract.filters.search}
          onClear={filterContract.reset}
        />
      ) : (
        <DataStateBlock
          variant="empty"
          title="No users found"
          description="Run LDAP sync to populate the directory."
        />
      )}
    </section>
  );
}
