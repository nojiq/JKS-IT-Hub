import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchSession } from "./auth-api.js";
import { fetchUserDetail, fetchUserHistory } from "./users-api.js";
import { CredentialRegeneration } from "../credentials/regeneration";
import { useInitiateRegeneration, useConfirmRegeneration, useUnlockCredential } from "../credentials/hooks/useCredentials.js";
import { useUserCredentials } from "../credentials/hooks/useCredentials.js";
import CredentialList from "../credentials/components/CredentialList.jsx";
import DisabledUserBanner from "../credentials/components/DisabledUserBanner.jsx";
import { CredentialExportButton } from "../exports/components/CredentialExportButton.jsx";

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
};

const formatDate = (value) => {
  if (!value) {
    return "Not synced yet";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
};

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showRegeneration, setShowRegeneration] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    retry: false,
    refetchOnWindowFocus: false
  });

  const userQuery = useQuery({
    queryKey: ["users", id],
    queryFn: () => fetchUserDetail(id),
    enabled: Boolean(sessionQuery.data && id)
  });

  const historyQuery = useQuery({
    queryKey: ["users", id, "history"],
    queryFn: () => fetchUserHistory(id),
    enabled: Boolean(sessionQuery.data && id && activeTab === "history")
  });

  const credentialsQuery = useUserCredentials(id);
  const initiateRegeneration = useInitiateRegeneration();
  const confirmRegeneration = useConfirmRegeneration();
  const unlockCredential = useUnlockCredential();
  const canManageCredentials = sessionQuery.data?.role && ['it', 'admin', 'head_it'].includes(sessionQuery.data.role);

  const payload = userQuery.data ?? { user: null, fields: [] };
  const user = payload.user;
  const fields = payload.fields ?? [];

  // Deduplicate fields to prevent duplicate React keys
  const uniqueFields = useMemo(() => [...new Set(fields)], [fields]);

  const rows = useMemo(
    () =>
      uniqueFields.map((field, index) => ({
        field,
        value: user?.ldapFields?.[field] ?? null,
        // Use combination of field and index for truly unique keys
        key: `${field}-${index}`
      })),
    [uniqueFields, user]
  );

  useEffect(() => {
    if (!sessionQuery.isLoading && sessionQuery.data === null) {
      navigate("/login", { replace: true });
    }
  }, [navigate, sessionQuery.data, sessionQuery.isLoading]);

  if (sessionQuery.isLoading) {
    return <p className="status-text">Checking session…</p>;
  }

  if (sessionQuery.error) {
    return (
      <div className="status-block">
        <p className="status-text">Session check failed.</p>
        <p className="status-hint">Try refreshing or signing in again.</p>
      </div>
    );
  }

  if (!sessionQuery.data) {
    return null;
  }

  if (userQuery.isLoading) {
    return <p className="status-text">Loading user details…</p>;
  }

  if (userQuery.error) {
    return (
      <div className="status-block">
        <p className="status-text">Unable to load user details.</p>
        <p className="status-hint">{userQuery.error.message}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="status-block">
        <p className="status-text">User not found.</p>
        <Link className="users-link" to="/users">
          Back to directory
        </Link>
      </div>
    );
  }

  return (
    <section className="user-detail">
      <header className="users-header">
        <div>
          <p className="users-eyebrow">User profile</p>
          <h2>{user.username}</h2>
          <p className="users-subtitle">LDAP fields are read-only in IT-Hub.</p>
        </div>
        <div className="users-header-actions">
          <Link className="users-link" to="/users">
            Back to directory
          </Link>
        </div>
      </header>

      {!user.ldapSyncedAt ? (
        <div className="users-alert">
          <p className="users-alert-title">LDAP sync has not run yet.</p>
          <p className="users-alert-text">
            Run manual sync to populate LDAP fields.
            <Link className="users-alert-link" to="/">
              Go to sync panel
            </Link>
          </p>
        </div>
      ) : null}

      <div className="user-detail-tabs">
        <button
          className={`tab-button ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          Profile
        </button>
        <button
          className={`tab-button ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          History
        </button>
      </div>

      <div className="user-detail-card">
        {activeTab === "profile" ? (
          <>
            <div className="user-detail-meta">
              <div>
                <span className="user-detail-label">Role</span>
                <span className="user-detail-value">{user.role}</span>
              </div>
              <div>
                <span className="user-detail-label">Status</span>
                <span className="user-detail-value">{user.status}</span>
              </div>
              <div>
                <span className="user-detail-label">Last LDAP sync</span>
                <span className="user-detail-value">{formatDate(user.ldapSyncedAt)}</span>
              </div>
            </div>

            <div className="user-detail-fields">
              <div className="user-detail-fields-header">
                <h3>LDAP fields</h3>
                <span className="user-detail-source">Source: LDAP</span>
              </div>
              <div className="user-detail-field-list">
                {rows.map((row) => (
                  <div className="user-detail-field" key={row.key}>
                    <span className="user-detail-field-label">{row.field}</span>
                    <span className="user-detail-field-value">{formatValue(row.value)}</span>
                    <span className="user-detail-field-source">Source: LDAP</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Credentials Section */}
            <div className="user-detail-credentials">
              <div className="user-detail-credentials-header">
                <h3>Credentials</h3>
                <div className="credentials-actions">
                  {credentialsQuery.data?.data?.length > 0 && canManageCredentials && (
                    <>
                      <Link
                        className="btn btn-secondary"
                        to={`/users/${id}/credentials/history`}
                      >
                        View History
                      </Link>
                      <CredentialExportButton userId={id} username={user.username} />
                    </>
                  )}
                  {canManageCredentials && (
                    <Link className="btn btn-secondary" to="/credentials/locked">
                      Locked Credentials
                    </Link>
                  )}
                  {canManageCredentials && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowRegeneration(true)}
                      disabled={user.status === 'disabled' || !user.ldapSyncedAt}
                      title={user.status === 'disabled' ? 'Cannot regenerate for disabled users' : !user.ldapSyncedAt ? 'LDAP sync required first' : 'Regenerate credentials'}
                    >
                      Regenerate Credentials
                    </button>
                  )}
                </div>
              </div>

              <DisabledUserBanner
                userName={user.username}
                userStatus={user.status}
                canEnableUser={sessionQuery.data?.role && ['it', 'admin', 'head_it'].includes(sessionQuery.data.role)}
              />

              {credentialsQuery.isLoading ? (
                <p className="credentials-loading">Loading credentials...</p>
              ) : credentialsQuery.error ? (
                <p className="credentials-error">Unable to load credentials</p>
              ) : credentialsQuery.data?.data?.length > 0 ? (
                <CredentialList
                  credentials={credentialsQuery.data.data}
                  userId={id}
                  userName={user.username}
                  userEmail={user.ldapFields?.mail}
                  canManageLocks={canManageCredentials}
                />
              ) : (
                <p className="credentials-empty">No active credentials for this user.</p>
              )}
            </div>

          </>
        ) : (
          <div className="user-detail-history">
            <div className="user-detail-history-header">
              <h3>LDAP Change History</h3>
              <span className="user-detail-source">Source: Audit Log</span>
            </div>

            {historyQuery.isLoading ? (
              <p className="history-loading">Loading history…</p>
            ) : historyQuery.error ? (
              <p className="history-error">Unable to load history: {historyQuery.error.message}</p>
            ) : historyQuery.data?.length > 0 ? (
              <div className="history-table-container">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Field</th>
                      <th>Old Value</th>
                      <th>New Value</th>
                      <th>Actor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyQuery.data.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDate(entry.timestamp)}</td>
                        <td>{entry.field}</td>
                        <td className="old-value">{formatValue(entry.oldValue)}</td>
                        <td className="new-value">{formatValue(entry.newValue)}</td>
                        <td>{entry.actor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="history-empty">
                <p>No LDAP changes recorded for this user.</p>
                <p className="history-hint">Changes will appear here after the next LDAP sync that modifies this user&apos;s attributes.</p>
              </div>
            )}
          </div>
        )}

        {/* Regeneration Modal */}
        {showRegeneration && (
          <div className="modal-overlay" onClick={() => setShowRegeneration(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <CredentialRegeneration
                userId={id}
                userName={user.username}
                userStatus={user.status}
                onInitiateRegeneration={initiateRegeneration.mutateAsync}
                onConfirmRegeneration={confirmRegeneration.mutateAsync}
                onUnlockCredential={unlockCredential.mutateAsync}
                onCancel={() => setShowRegeneration(false)}
                onSuccess={() => {
                  setShowRegeneration(false);
                  credentialsQuery.refetch();
                }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
