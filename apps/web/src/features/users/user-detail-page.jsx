import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchSession } from "./auth-api.js";
import { fetchUserDetail } from "./users-api.js";
import { CredentialRegeneration } from "../credentials/regeneration";
import { useInitiateRegeneration, useConfirmRegeneration } from "../credentials/hooks/useCredentials.js";
import { useUserCredentials } from "../credentials/hooks/useCredentials.js";

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

  const credentialsQuery = useUserCredentials(id);
  const initiateRegeneration = useInitiateRegeneration();
  const confirmRegeneration = useConfirmRegeneration();

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

  const payload = userQuery.data ?? { user: null, fields: [] };
  const user = payload.user;
  const fields = payload.fields ?? [];
  const rows = useMemo(
    () =>
      fields.map((field) => ({
        field,
        value: user?.ldapFields?.[field] ?? null
      })),
    [fields, user]
  );

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

      <div className="user-detail-card">
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
            {rows.map(({ field, value }) => (
              <div className="user-detail-field" key={field}>
                <span className="user-detail-field-label">{field}</span>
                <span className="user-detail-field-value">{formatValue(value)}</span>
                <span className="user-detail-field-source">Source: LDAP</span>
              </div>
            ))}
          </div>
        </div>

        {/* Credentials Section */}
        <div className="user-detail-credentials">
          <div className="user-detail-credentials-header">
            <h3>Credentials</h3>
            {sessionQuery.data?.role && ['it', 'admin', 'head_it'].includes(sessionQuery.data.role) && (
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
          
          {credentialsQuery.isLoading ? (
            <p className="credentials-loading">Loading credentials...</p>
          ) : credentialsQuery.error ? (
            <p className="credentials-error">Unable to load credentials</p>
          ) : credentialsQuery.data?.data?.length > 0 ? (
            <div className="credentials-list">
              {credentialsQuery.data.data.map((credential) => (
                <div key={credential.id} className="credential-item">
                  <div className="credential-system">{credential.system}</div>
                  <div className="credential-details">
                    <span className="credential-username">{credential.username}</span>
                    <span className="credential-version">v{credential.templateVersion}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="credentials-empty">No active credentials for this user.</p>
          )}
        </div>

        {/* Regeneration Modal */}
        {showRegeneration && (
          <div className="modal-overlay" onClick={() => setShowRegeneration(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <CredentialRegeneration
                userId={id}
                userName={user.username}
                onInitiateRegeneration={initiateRegeneration.mutateAsync}
                onConfirmRegeneration={confirmRegeneration.mutateAsync}
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
