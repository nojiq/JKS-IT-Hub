import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchSession } from "./auth-api.js";
import { fetchUserDetail, fetchUserHistory, updateUserStatus } from "./users-api.js";
import { CredentialRegeneration } from "../credentials/regeneration";
import { useInitiateRegeneration, useConfirmRegeneration, useUnlockCredential } from "../credentials/hooks/useCredentials.js";
import { useUserCredentials } from "../credentials/hooks/useCredentials.js";
import CredentialList from "../credentials/components/CredentialList.jsx";
import DisabledUserBanner from "../credentials/components/DisabledUserBanner.jsx";
import CredentialGenerator from "../credentials/generation/CredentialGenerator.jsx";
import { CredentialExportButton } from "../exports/components/CredentialExportButton.jsx";
import { DataStateBlock } from "../../shared/workspace/DataStateBlock.jsx";
import { WorkspacePageHeader } from "../../shared/workspace/WorkspacePageHeader.jsx";
import { WorkspacePanel } from "../../shared/workspace/WorkspacePanel.jsx";

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
  const queryClient = useQueryClient();

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
    enabled: Boolean(sessionQuery.data && id)
  });

  const credentialsQuery = useUserCredentials(id);
  const initiateRegeneration = useInitiateRegeneration();
  const confirmRegeneration = useConfirmRegeneration();
  const unlockCredential = useUnlockCredential();
  const sessionUser = sessionQuery.data?.user ?? sessionQuery.data ?? null;
  const canManageCredentials = sessionUser?.role && ['it', 'admin', 'head_it'].includes(sessionUser.role);
  const canEnableUsers = sessionUser?.role && ['admin', 'head_it'].includes(sessionUser.role);
  const updateUserStatusMutation = useMutation({
    mutationFn: ({ userId, status }) => updateUserStatus(userId, status),
    onSuccess: async () => {
      await Promise.all([
        userQuery.refetch(),
        credentialsQuery.refetch()
      ]);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const payload = userQuery.data ?? { user: null, fields: [] };
  const user = payload.user;
  const fields = payload.fields ?? [];
  const historyEntries = historyQuery.data ?? [];

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

  const handleEnableUser = async () => {
    if (!canEnableUsers || updateUserStatusMutation.isPending) return;
    await updateUserStatusMutation.mutateAsync({ userId: id, status: "active" });
  };

  if (sessionQuery.isLoading) {
    return (
      <section className="workspace-page">
        <DataStateBlock
          variant="loading"
          title="Loading user workspace"
          description="Checking session and fetching profile data."
        />
      </section>
    );
  }

  if (sessionQuery.error) {
    return (
      <section className="workspace-page">
        <DataStateBlock
          variant="error"
          title="Unable to load user workspace"
          description="Try refreshing or signing in again."
        />
      </section>
    );
  }

  if (!sessionQuery.data) {
    return null;
  }

  if (userQuery.isLoading) {
    return (
      <section className="workspace-page">
        <DataStateBlock
          variant="loading"
          title="Loading user details"
          description="Fetching profile, directory, and credential data."
        />
      </section>
    );
  }

  if (userQuery.error) {
    return (
      <section className="workspace-page">
        <DataStateBlock
          variant="error"
          title="Unable to load user details"
          description={userQuery.error.message}
        />
      </section>
    );
  }

  if (!user) {
    return (
      <section className="workspace-page">
        <DataStateBlock
          variant="empty"
          title="User not found"
          description="Return to directory to select another user."
          actionLabel="Back to directory"
          onAction={() => navigate("/users/directory")}
        />
      </section>
    );
  }

  return (
    <section className="workspace-page user-detail-page">
      <WorkspacePageHeader
        eyebrow="Users & Credentials"
        title={user.username}
        description="Review identity state, credential tools, and recent access work from one user workspace."
        actions={(
          <Link className="workspace-inline-link" to="/users/directory">
            Back to directory
          </Link>
        )}
      />

      {!user.ldapSyncedAt ? (
        <div className="users-alert">
          <p className="users-alert-title">LDAP sync has not run yet.</p>
          <p className="users-alert-text">
            Run manual sync to populate LDAP fields.
            <Link className="users-alert-link" to="/users/directory">
              Go to sync panel
            </Link>
          </p>
        </div>
      ) : null}

      <div className="user-detail-zone-grid">
        <WorkspacePanel variant="detail" title="Identity" meta="Read-only identity snapshot from the latest sync.">
          <div className="user-detail-meta">
            <div>
              <span className="user-detail-label">Username</span>
              <span className="user-detail-value">{user.username}</span>
            </div>
            <div>
              <span className="user-detail-label">Email</span>
              <span className="user-detail-value">{formatValue(user.ldapFields?.mail)}</span>
            </div>
            <div>
              <span className="user-detail-label">Department</span>
              <span className="user-detail-value">{formatValue(user.ldapFields?.department)}</span>
            </div>
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
        </WorkspacePanel>

        <WorkspacePanel variant="detail" title="Account Status" meta="Operational status and sync checkpoints for this account.">
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
        </WorkspacePanel>

        <WorkspacePanel
          variant="detail"
          title="Credentials"
          meta="Generated credentials, exports, locks, and regeneration controls."
          actions={(
            <div className="credentials-actions">
              {canManageCredentials && credentialsQuery.data?.data?.length > 0 ? (
                <Link className="workspace-inline-link" to={`/users/${id}/credentials/history`}>
                  View History
                </Link>
              ) : null}
              {canManageCredentials ? (
                <Link className="workspace-inline-link" to={`/users/imap-generator?userId=${id}`}>
                  Open IMAP Generator
                </Link>
              ) : null}
              {canManageCredentials ? (
                <CredentialExportButton
                  userId={id}
                  username={user.username}
                  credentials={credentialsQuery.data?.data || []}
                />
              ) : null}
              {canManageCredentials ? (
                <Link className="workspace-inline-link" to="/users/locked">
                  Locked Credentials
                </Link>
              ) : null}
              {canManageCredentials ? (
                <button
                  className="workspace-inline-button"
                  onClick={() => setShowRegeneration(true)}
                  disabled={user.status === "disabled" || !user.ldapSyncedAt}
                  title={user.status === "disabled" ? "Cannot regenerate for disabled users" : !user.ldapSyncedAt ? "LDAP sync required first" : "Regenerate credentials"}
                  type="button"
                >
                  Regenerate Credentials
                </button>
              ) : null}
            </div>
          )}
        >
          {canManageCredentials ? (
            <CredentialGenerator
              userId={id}
              userName={user.username}
              userStatus={user.status}
              userLdapFields={user.ldapFields}
              canEnableUser={canEnableUsers}
              onEnableUser={canEnableUsers ? handleEnableUser : undefined}
            />
          ) : (
            <>
              <DisabledUserBanner
                userName={user.username}
                userStatus={user.status}
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
            </>
          )}
        </WorkspacePanel>

        <WorkspacePanel
          variant="detail"
          title="Recent Actions"
          meta="Most recent LDAP changes and credential follow-up entry points."
          actions={(
            <Link className="workspace-inline-link" to={`/users/${id}/credentials/history`}>
              Full History
            </Link>
          )}
        >
          {historyQuery.isLoading ? (
            <p className="history-loading">Loading history…</p>
          ) : historyQuery.error ? (
            <p className="history-error">Unable to load history: {historyQuery.error.message}</p>
          ) : historyEntries.length > 0 ? (
            <div className="user-detail-recent-actions">
              {historyEntries.slice(0, 5).map((entry) => (
                <div className="user-detail-action-row" key={entry.id}>
                  <strong>{entry.field}</strong>
                  <span>{formatDate(entry.timestamp)}</span>
                  <span>{formatValue(entry.newValue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="history-empty">
              <p>No LDAP changes recorded for this user.</p>
              <p className="history-hint">Changes will appear here after the next LDAP sync that modifies this user&apos;s attributes.</p>
            </div>
          )}
        </WorkspacePanel>
      </div>

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
              onEnableUser={canEnableUsers ? handleEnableUser : undefined}
              onCancel={() => setShowRegeneration(false)}
              onSuccess={() => {
                setShowRegeneration(false);
                credentialsQuery.refetch();
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
