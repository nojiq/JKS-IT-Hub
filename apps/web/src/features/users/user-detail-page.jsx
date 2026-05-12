import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchSession } from "./auth-api.js";
import { fetchUserDetail, fetchUserHistory, updateUserProfileFields, updateUserStatus } from "./users-api.js";
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

const getLdapValue = (fields, keys = []) => {
  if (!fields || typeof fields !== "object") {
    return null;
  }

  const entries = Object.entries(fields);
  for (const key of keys) {
    if (fields[key] !== undefined && fields[key] !== null && fields[key] !== "") {
      return fields[key];
    }

    const matched = entries.find(([entryKey]) => entryKey.toLowerCase() === key.toLowerCase());
    if (matched?.[1] !== undefined && matched[1] !== null && matched[1] !== "") {
      return matched[1];
    }
  }

  return null;
};

const getProfileFieldFallback = (field, user) => {
  if (field.key === "name") {
    const value = getLdapValue(user?.ldapFields, ["displayName", "cn", "name"]);
    return value ? { value, source: "ldap" } : null;
  }

  if (field.key === "email") {
    const value = getLdapValue(user?.ldapFields, ["mail", "email", "userPrincipalName"]);
    return value ? { value, source: "ldap" } : null;
  }

  return null;
};

const buildProfileFieldDraft = (fields = []) => {
  return Object.fromEntries(fields.map((field) => [field.key, field.value ?? ""]));
};

const profileFieldInputType = (type) => {
  if (type === "email" || type === "date" || type === "password") {
    return type;
  }
  return "text";
};

const formatProfileFieldValue = (field, value, canRevealSensitive = false) => {
  if (field.sensitive && value && !canRevealSensitive) {
    return "********";
  }
  return formatValue(value);
};

const EMPTY_PROFILE_FIELDS = [];

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showRegeneration, setShowRegeneration] = useState(false);
  const [isEditingProfileFields, setIsEditingProfileFields] = useState(false);
  const [profileFieldDraft, setProfileFieldDraft] = useState({});
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
  const canEditProfileFields = sessionUser?.role && ['it', 'admin', 'head_it'].includes(sessionUser.role);
  const canEnableUsers = sessionUser?.role && ['admin', 'head_it'].includes(sessionUser.role);
  const updateProfileFieldsMutation = useMutation({
    mutationFn: ({ userId, values }) => updateUserProfileFields(userId, values),
    onSuccess: async () => {
      setIsEditingProfileFields(false);
      await userQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });
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
  const profileFields = user?.profileFields ?? EMPTY_PROFILE_FIELDS;

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

  useEffect(() => {
    if (user && !isEditingProfileFields) {
      setProfileFieldDraft(buildProfileFieldDraft(profileFields));
    }
  }, [isEditingProfileFields, profileFields, user]);

  const handleEnableUser = async () => {
    if (!canEnableUsers || updateUserStatusMutation.isPending) return;
    await updateUserStatusMutation.mutateAsync({ userId: id, status: "active" });
  };

  const handleStartEditProfileFields = () => {
    setProfileFieldDraft(buildProfileFieldDraft(profileFields));
    setIsEditingProfileFields(true);
  };

  const handleCancelEditProfileFields = () => {
    setProfileFieldDraft(buildProfileFieldDraft(profileFields));
    setIsEditingProfileFields(false);
  };

  const handleProfileFieldChange = (key, value) => {
    setProfileFieldDraft((current) => ({
      ...current,
      [key]: value
    }));
  };

  const handleSaveProfileFields = async (event) => {
    event.preventDefault();
    if (!canEditProfileFields || updateProfileFieldsMutation.isPending) return;
    await updateProfileFieldsMutation.mutateAsync({
      userId: id,
      values: profileFieldDraft
    });
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
        <WorkspacePanel
          variant="detail"
          title="Identity"
          meta={isEditingProfileFields ? "Edit manual profile fields. LDAP rows remain read-only below." : "Manual profile fields and read-only LDAP snapshot from the latest sync."}
          actions={canEditProfileFields && !isEditingProfileFields ? (
            <button
              className="workspace-inline-button"
              type="button"
              onClick={handleStartEditProfileFields}
              aria-label="Edit profile fields"
            >
              Edit
            </button>
          ) : null}
        >
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

          {profileFields.length ? (
            isEditingProfileFields ? (
              <form className="user-detail-field-list" onSubmit={handleSaveProfileFields}>
                {profileFields.map((field) => (
                  <label className="user-detail-field" key={field.key}>
                    <span className="user-detail-field-label">{field.label}</span>
                    {field.type === "textarea" ? (
                      <textarea
                        className="form-control"
                        value={profileFieldDraft[field.key] ?? ""}
                        onChange={(event) => handleProfileFieldChange(field.key, event.target.value)}
                        required={field.required}
                        rows={3}
                      />
                    ) : (
                      <input
                        className="form-control"
                        type={profileFieldInputType(field.type)}
                        value={profileFieldDraft[field.key] ?? ""}
                        onChange={(event) => handleProfileFieldChange(field.key, event.target.value)}
                        required={field.required}
                      />
                    )}
                  </label>
                ))}
                {updateProfileFieldsMutation.error ? (
                  <p className="credentials-error">{updateProfileFieldsMutation.error.message}</p>
                ) : null}
                <div className="credentials-actions">
                  <button
                    className="workspace-inline-button"
                    type="submit"
                    disabled={updateProfileFieldsMutation.isPending}
                    aria-label="Save profile fields"
                  >
                    {updateProfileFieldsMutation.isPending ? "Saving..." : "Save"}
                  </button>
                  <button
                    className="workspace-inline-link"
                    type="button"
                    onClick={handleCancelEditProfileFields}
                    disabled={updateProfileFieldsMutation.isPending}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="user-detail-field-list">
                {profileFields.map((field) => {
                  const fallback = !field.value ? getProfileFieldFallback(field, user) : null;
                  const value = field.value || fallback?.value || null;
                  const source = field.source || fallback?.source || null;

                  return (
                    <div className="user-detail-field" key={field.key}>
                      <span className="user-detail-field-label">{field.label}</span>
                      <span className="user-detail-field-value">{formatProfileFieldValue(field, value, canEditProfileFields)}</span>
                      {source ? (
                        <span className="user-detail-field-source">
                          Source: {source === "ldap" ? "LDAP" : "Manual"}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )
          ) : null}

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
          actions={canManageCredentials ? (
            <div className="user-detail-credentials-header-toolbar" role="toolbar" aria-label="Credential shortcuts">
              {credentialsQuery.data?.data?.length > 0 ? (
                <Link className="workspace-inline-link" to={`/users/${id}/credentials/history`}>
                  View History
                </Link>
              ) : null}
                <Link className="workspace-inline-link" to={`/users/credential-generator?mode=imap&userId=${id}`}>
                Open Credential Generator
              </Link>
              <Link className="workspace-inline-link" to="/users/locked">
                Locked Credentials
              </Link>
              <button
                className="workspace-inline-button"
                onClick={() => setShowRegeneration(true)}
                disabled={user.status === "disabled" || !user.ldapSyncedAt}
                title={user.status === "disabled" ? "Cannot regenerate for disabled users" : !user.ldapSyncedAt ? "LDAP sync required first" : "Regenerate credentials"}
                type="button"
              >
                Regenerate Credentials
              </button>
            </div>
          ) : null}
        >
          {canManageCredentials ? (
            <>
              <div className="user-detail-credentials-export-block">
                <CredentialExportButton
                  userId={id}
                  username={user.username}
                  credentials={credentialsQuery.data?.data || []}
                />
              </div>
              <CredentialGenerator
                userId={id}
                userName={user.username}
                userStatus={user.status}
                userLdapFields={user.ldapFields}
                canEnableUser={canEnableUsers}
                onEnableUser={canEnableUsers ? handleEnableUser : undefined}
              />
            </>
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
