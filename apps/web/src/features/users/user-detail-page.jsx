import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchSession } from "./auth-api.js";
import { fetchUserDetail, fetchUserHistory, updateUserProfileFields, updateUserPulseOrg, updateUserRole, updateUserStatus } from "./users-api.js";
import { fetchPulseOrgHierarchy } from "../onboarding/onboarding-api.js";
import { ROLE_LABELS } from "./roleLabels.js";
import { assertCanAssignRole, getAssignableRoles, ROLE_RANK } from "../../shared/auth/roleAssignment.js";
import { CredentialRegeneration } from "../credentials/regeneration";
import { useInitiateRegeneration, useConfirmRegeneration } from "../credentials/hooks/useCredentials.js";
import { useUserCredentials } from "../credentials/hooks/useCredentials.js";
import CredentialList from "../credentials/components/CredentialList.jsx";
import DisabledUserBanner from "../credentials/components/DisabledUserBanner.jsx";
import CredentialGenerator from "../credentials/generation/CredentialGenerator.jsx";
import { CredentialExportButton } from "../exports/components/CredentialExportButton.jsx";
import { DataStateBlock } from "../../shared/workspace/DataStateBlock.jsx";
import { WorkspacePageHeader } from "../../shared/workspace/WorkspacePageHeader.jsx";
import { WorkspacePanel } from "../../shared/workspace/WorkspacePanel.jsx";
import { formatDisplayDateTime } from "../../shared/utils/date-format.js";
import { UserAssignedAssetsPanel } from "../assets/components/UserAssignedAssetsPanel.jsx";

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

const formatLdapValue = (_field, value) => formatValue(value);

/** Omit LDAP rows duplicated on this page (Pulse org, profile Date / telephone, etc.). */
const LDAP_FIELD_KEYS_HIDDEN_ON_USER_DETAIL = new Set([
  "birthdate",
  "cn",
  "department",
  "employeenumber",
  "telephonenumber"
]);

/** Friendly labels for raw LDAP attribute names in the read-only list. */
const LDAP_FIELD_LABELS = {
  givenname: "First name",
  samaccountname: "Username",
  sn: "Last name"
};

const formatLdapFieldLabel = (field) => {
  const key = String(field ?? "").toLowerCase();
  return LDAP_FIELD_LABELS[key] ?? String(field ?? "");
};

const formatDate = (value) => {
  if (!value) {
    return "Not synced yet";
  }
  return formatDisplayDateTime(value, { fallback: String(value) });
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

  if (field.key === "telephone-number") {
    const value = getLdapValue(user?.ldapFields, ["telephoneNumber", "mobile", "telephone"]);
    return value ? { value: String(value), source: "ldap" } : null;
  }

  return null;
};

const getEditableProfileValue = (field, user) => {
  if (field.value !== null && field.value !== undefined && field.value !== "") {
    return field.value;
  }
  const fallback = getProfileFieldFallback(field, user);
  return fallback?.value ?? "";
};

const buildProfileFieldDraft = (fields = [], user) => {
  if (!user) {
    return {};
  }
  return Object.fromEntries(fields.map((field) => [field.key, getEditableProfileValue(field, user)]));
};

const profileFieldInputType = (type, fieldKey) => {
  /** Yahoo vendor temp is not a secret login password — show plain while editing. */
  if (fieldKey === "temporary-password") {
    return "text";
  }
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

const getSelectedPulseOrg = ({ hierarchy, divisionId, departmentId, sectionId }) => {
  const division = (hierarchy.divisions ?? []).find((entry) => entry.id === divisionId);
  const department = (hierarchy.departments ?? []).find((entry) => entry.id === departmentId);
  const section = (hierarchy.sections ?? []).find((entry) => entry.id === sectionId);

  return {
    division: division ? { id: division.id, name: division.name } : null,
    department: department ? { id: department.id, name: department.name } : null,
    section: section ? { id: section.id, name: section.name } : null
  };
};

const EMPTY_PROFILE_FIELDS = [];

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showRegeneration, setShowRegeneration] = useState(false);
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [profileFieldDraft, setProfileFieldDraft] = useState({});
  const [roleDraft, setRoleDraft] = useState("");
  const [pulseDivisionId, setPulseDivisionId] = useState("");
  const [pulseDepartmentId, setPulseDepartmentId] = useState("");
  const [pulseSectionId, setPulseSectionId] = useState("");
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
  const sessionUser = sessionQuery.data?.user ?? sessionQuery.data ?? null;
  const canManageCredentials = sessionUser?.role && ['dev', 'it', 'admin', 'head_it'].includes(sessionUser.role);
  const canEditProfileFields = sessionUser?.role && ['dev', 'it', 'admin', 'head_it'].includes(sessionUser.role);
  const canEnableUsers = sessionUser?.role && ['dev', 'admin', 'head_it'].includes(sessionUser.role);

  const pulseOrgQuery = useQuery({
    queryKey: ["onboarding", "pulse-org-hierarchy"],
    queryFn: fetchPulseOrgHierarchy,
    enabled: Boolean(sessionQuery.data && canEditProfileFields)
  });

  const pulseHierarchy = useMemo(
    () =>
      pulseOrgQuery.data ?? {
        enabled: false,
        divisions: [],
        departments: [],
        sections: []
      },
    [pulseOrgQuery.data]
  );

  const departmentsInSelectedDivision = useMemo(() => {
    const all = pulseHierarchy.departments ?? [];
    if (!pulseDivisionId) {
      return all;
    }
    return all.filter((d) => d.divisionId === pulseDivisionId);
  }, [pulseHierarchy.departments, pulseDivisionId]);

  const sectionsInSelectedDepartment = useMemo(() => {
    if (!pulseDepartmentId) {
      return [];
    }
    return (pulseHierarchy.sections ?? []).filter((s) => s.departmentId === pulseDepartmentId);
  }, [pulseHierarchy.sections, pulseDepartmentId]);

  const canEditPulseOrg = Boolean(canEditProfileFields && pulseHierarchy.enabled);

  const canAssignRoleOnTarget = useMemo(() => {
    if (!sessionUser || !userQuery.data?.user) return false;
    const target = userQuery.data.user;
    if (sessionUser.id === target.id) return false;
    return getAssignableRoles(sessionUser.role).some((r) =>
      assertCanAssignRole(sessionUser, target, r).ok
    );
  }, [sessionUser, userQuery.data]);

  const roleSelectOptions = useMemo(() => {
    if (!sessionUser || !userQuery.data?.user) return [];
    const target = userQuery.data.user;
    if (sessionUser.id === target.id) return [];
    const opts = getAssignableRoles(sessionUser.role).filter((r) =>
      assertCanAssignRole(sessionUser, target, r).ok
    );
    const set = new Set(opts);
    set.add(target.role);
    return [...set].sort((a, b) => ROLE_RANK[a] - ROLE_RANK[b]);
  }, [sessionUser, userQuery.data]);

  const canEditIdentity =
    Boolean(canEditProfileFields) &&
    Boolean(
      (userQuery.data?.user?.profileFields?.length ?? 0) > 0 ||
        canAssignRoleOnTarget ||
        canEditPulseOrg
    );

  const updateProfileFieldsMutation = useMutation({
    mutationFn: ({ userId, values }) => updateUserProfileFields(userId, values),
    onSuccess: async () => {
      await userQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => updateUserRole(userId, role),
    onSuccess: async () => {
      await userQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const updatePulseOrgMutation = useMutation({
    mutationFn: ({ userId, pulseOrg }) => updateUserPulseOrg(userId, pulseOrg),
    onSuccess: async () => {
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

  // Deduplicate fields to prevent duplicate React keys; drop LDAP keys duplicated elsewhere on this page
  const uniqueFields = useMemo(
    () =>
      [...new Set(fields)].filter(
        (fieldName) => !LDAP_FIELD_KEYS_HIDDEN_ON_USER_DETAIL.has(String(fieldName).toLowerCase())
      ),
    [fields]
  );

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
  const pulseOrgRows = useMemo(() => {
    if (!user?.orgSnapshot) {
      return [];
    }
    return [
      { key: "pulse-division", field: "Division", value: user.orgSnapshot.division?.name },
      { key: "pulse-department", field: "Department", value: user.orgSnapshot.department?.name },
      { key: "pulse-section", field: "Section", value: user.orgSnapshot.section?.name }
    ].filter((row) => row.value);
  }, [user]);

  useEffect(() => {
    if (!sessionQuery.isLoading && sessionQuery.data === null) {
      navigate("/login", { replace: true });
    }
  }, [navigate, sessionQuery.data, sessionQuery.isLoading]);

  useEffect(() => {
    if (user && !isEditingIdentity) {
      setProfileFieldDraft(buildProfileFieldDraft(profileFields, user));
      const snap = user.orgSnapshot;
      setPulseDivisionId(snap?.division?.id ? String(snap.division.id) : "");
      setPulseDepartmentId(snap?.department?.id ? String(snap.department.id) : "");
      setPulseSectionId(snap?.section?.id ? String(snap.section.id) : "");
    }
  }, [isEditingIdentity, profileFields, user]);

  const handleEnableUser = async () => {
    if (!canEnableUsers || updateUserStatusMutation.isPending) return;
    await updateUserStatusMutation.mutateAsync({ userId: id, status: "active" });
  };

  const handleStartEditIdentity = () => {
    setProfileFieldDraft(buildProfileFieldDraft(profileFields, user));
    setRoleDraft(user.role);
    const snap = user?.orgSnapshot;
    setPulseDivisionId(snap?.division?.id ? String(snap.division.id) : "");
    setPulseDepartmentId(snap?.department?.id ? String(snap.department.id) : "");
    setPulseSectionId(snap?.section?.id ? String(snap.section.id) : "");
    setIsEditingIdentity(true);
  };

  const handleCancelEditIdentity = () => {
    setProfileFieldDraft(buildProfileFieldDraft(profileFields, user));
    setRoleDraft(user.role);
    const snap = user?.orgSnapshot;
    setPulseDivisionId(snap?.division?.id ? String(snap.division.id) : "");
    setPulseDepartmentId(snap?.department?.id ? String(snap.department.id) : "");
    setPulseSectionId(snap?.section?.id ? String(snap.section.id) : "");
    setIsEditingIdentity(false);
  };

  const handlePulseDivisionChange = (nextDivisionId) => {
    setPulseDivisionId(nextDivisionId);
    setPulseDepartmentId("");
    setPulseSectionId("");
  };

  const handlePulseDepartmentChange = (nextDepartmentId) => {
    setPulseDepartmentId(nextDepartmentId);
    setPulseSectionId("");
  };

  const handlePulseSectionChange = (nextSectionId) => {
    setPulseSectionId(nextSectionId);
  };

  const handleProfileFieldChange = (key, value) => {
    setProfileFieldDraft((current) => ({
      ...current,
      [key]: value
    }));
  };

  const identitySavePending =
    updateProfileFieldsMutation.isPending ||
    updateUserRoleMutation.isPending ||
    updatePulseOrgMutation.isPending;

  const handleSaveIdentity = async (event) => {
    event.preventDefault();
    if (!canEditIdentity || identitySavePending || !user) return;

    const roleChanged = canAssignRoleOnTarget && roleDraft !== user.role;
    const hasProfileFields = profileFields.length > 0;

    if (roleChanged) {
      const decision = assertCanAssignRole(sessionUser, user, roleDraft);
      if (!decision.ok) return;
    }

    try {
      if (roleChanged) {
        await updateUserRoleMutation.mutateAsync({ userId: id, role: roleDraft });
      }
      if (hasProfileFields) {
        await updateProfileFieldsMutation.mutateAsync({
          userId: id,
          values: profileFieldDraft
        });
      }
      if (canEditPulseOrg) {
        const pulseOrg = getSelectedPulseOrg({
          hierarchy: pulseHierarchy,
          divisionId: pulseDivisionId,
          departmentId: pulseDepartmentId,
          sectionId: pulseSectionId
        });
        await updatePulseOrgMutation.mutateAsync({ userId: id, pulseOrg });
      }
      setIsEditingIdentity(false);
      await historyQuery.refetch();
    } catch {
      // Errors surface via mutation error state
    }
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
    <section
      className={`workspace-page user-detail-page${isEditingIdentity ? " user-detail-page--identity-editing" : ""}`}
    >
      <WorkspacePageHeader
        eyebrow="Users & Credentials"
        title={user.username}
        titleHint="Review identity state, credential tools, and recent access work from one user workspace."
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
          titleHint={
            isEditingIdentity
              ? "Edit profile fields first, then role and JKSPulse org (when enabled), then save. LDAP rows stay read-only."
              : canAssignRoleOnTarget
                ? "Manual profile fields, role, and read-only LDAP snapshot from the latest sync."
                : "Manual profile fields and read-only LDAP snapshot from the latest sync."
          }
          actions={
            canEditIdentity && !isEditingIdentity ? (
              <button
                className="workspace-inline-button"
                type="button"
                onClick={handleStartEditIdentity}
                aria-label="Edit identity"
              >
                Edit
              </button>
            ) : null
          }
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
            {!isEditingIdentity && canAssignRoleOnTarget ? (
              <div>
                <span className="user-detail-label">Role</span>
                <span className="user-detail-value">{ROLE_LABELS[user.role] ?? user.role}</span>
              </div>
            ) : null}
            <div>
              <span className="user-detail-label">Department</span>
              <span className="user-detail-value">
                {formatValue(user.orgSnapshot?.department?.name ?? user.ldapFields?.department)}
              </span>
            </div>
          </div>

          {isEditingIdentity ? (
            <>
              <form
                id="user-identity-edit-form"
                className="user-detail-identity-form user-detail-field-list"
                onSubmit={handleSaveIdentity}
              >
                {profileFields.map((field) => (
                  <label className="user-detail-field user-detail-field--editable" key={field.key}>
                    <span className="user-detail-field-label">{field.label}</span>
                    {field.type === "textarea" ? (
                      <textarea
                        className="user-detail-input"
                        value={profileFieldDraft[field.key] ?? ""}
                        onChange={(event) => handleProfileFieldChange(field.key, event.target.value)}
                        required={field.required}
                        rows={3}
                      />
                    ) : (
                      <input
                        className="user-detail-input"
                        type={profileFieldInputType(field.type, field.key)}
                        autoComplete={field.key === "temporary-password" ? "off" : undefined}
                        value={profileFieldDraft[field.key] ?? ""}
                        onChange={(event) => handleProfileFieldChange(field.key, event.target.value)}
                        required={field.required}
                      />
                    )}
                  </label>
                ))}
                {canAssignRoleOnTarget ? (
                  <label className="user-detail-field user-detail-field--editable" htmlFor="user-role-select">
                    <span className="user-detail-field-label">Role</span>
                    <select
                      id="user-role-select"
                      className="user-detail-input"
                      value={roleDraft}
                      onChange={(event) => setRoleDraft(event.target.value)}
                      aria-label="Assign user role"
                    >
                      {roleSelectOptions.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r] ?? r}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {canEditPulseOrg ? (
                  <>
                    <label className="user-detail-field user-detail-field--editable" htmlFor="ud-pulse-division">
                      <span className="user-detail-field-label">Division (JKSPulse)</span>
                      <select
                        id="ud-pulse-division"
                        className="user-detail-input"
                        value={pulseDivisionId}
                        onChange={(event) => handlePulseDivisionChange(event.target.value)}
                        disabled={pulseOrgQuery.isLoading}
                        aria-label="JKSPulse division"
                      >
                        <option value="">Select division</option>
                        {(pulseHierarchy.divisions ?? []).map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="user-detail-field user-detail-field--editable" htmlFor="ud-pulse-department">
                      <span className="user-detail-field-label">Department (JKSPulse)</span>
                      <select
                        id="ud-pulse-department"
                        className="user-detail-input"
                        value={pulseDepartmentId}
                        onChange={(event) => handlePulseDepartmentChange(event.target.value)}
                        disabled={pulseOrgQuery.isLoading || !departmentsInSelectedDivision.length}
                        aria-label="JKSPulse department"
                      >
                        <option value="">Select department</option>
                        {departmentsInSelectedDivision.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="user-detail-field user-detail-field--editable" htmlFor="ud-pulse-section">
                      <span className="user-detail-field-label">Section (JKSPulse)</span>
                      <select
                        id="ud-pulse-section"
                        className="user-detail-input"
                        value={pulseSectionId}
                        onChange={(event) => handlePulseSectionChange(event.target.value)}
                        disabled={
                          pulseOrgQuery.isLoading ||
                          !pulseDepartmentId ||
                          !sectionsInSelectedDepartment.length
                        }
                        aria-label="JKSPulse section"
                      >
                        <option value="">
                          {!pulseDepartmentId
                            ? "Select department first"
                            : sectionsInSelectedDepartment.length
                              ? "Select section"
                              : "No sections"}
                        </option>
                        {sectionsInSelectedDepartment.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {pulseOrgQuery.isError ? (
                      <p className="credentials-error" role="alert">
                        Could not load JKSPulse hierarchy. Try again or check Pulse configuration.
                      </p>
                    ) : null}
                  </>
                ) : null}
                {updateProfileFieldsMutation.error || updateUserRoleMutation.error || updatePulseOrgMutation.error ? (
                  <p className="credentials-error">
                    {(updateUserRoleMutation.error ||
                      updateProfileFieldsMutation.error ||
                      updatePulseOrgMutation.error)?.message}
                  </p>
                ) : null}
              </form>
              <div
                className="user-detail-identity-float-bar"
                role="toolbar"
                aria-label="Identity edit actions"
              >
                <div className="user-detail-identity-float-bar__inner">
                  <button
                    className="workspace-inline-link"
                    type="button"
                    onClick={handleCancelEditIdentity}
                    disabled={identitySavePending}
                  >
                    Cancel
                  </button>
                  <button
                    className="workspace-inline-button"
                    type="submit"
                    form="user-identity-edit-form"
                    disabled={identitySavePending}
                    aria-label="Save identity changes"
                  >
                    {identitySavePending ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </>
          ) : profileFields.length ? (
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
          ) : null}

          {isEditingIdentity && pulseHierarchy.enabled
            ? null
            : pulseOrgRows.length ? (
            <div className="user-detail-field-list">
              {pulseOrgRows.map((row) => (
                <div className="user-detail-field" key={row.key}>
                  <span className="user-detail-field-label">{row.field}</span>
                  <span className="user-detail-field-value">{formatValue(row.value)}</span>
                  <span className="user-detail-field-source">Source: JKSPulse</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="user-detail-field-list">
            {rows.map((row) => (
              <div className="user-detail-field" key={row.key}>
                <span className="user-detail-field-label">{formatLdapFieldLabel(row.field)}</span>
                <span className="user-detail-field-value">{formatLdapValue(row.field, row.value)}</span>
                <span className="user-detail-field-source">Source: LDAP</span>
              </div>
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          variant="detail"
          title="Assigned assets"
          meta="Hardware inventory items linked to this user in IT Hub."
        >
          <UserAssignedAssetsPanel userId={id} />
        </WorkspacePanel>

        <WorkspacePanel variant="detail" title="Account Status" meta="Operational status and sync checkpoints for this account.">
          <div className="user-detail-meta">
            {!canAssignRoleOnTarget ? (
              <div>
                <span className="user-detail-label">Role</span>
                <span className="user-detail-value">{ROLE_LABELS[user.role] ?? user.role}</span>
              </div>
            ) : null}
            <div>
              <span className="user-detail-label">Status</span>
              <span className="user-detail-value">{user.status}</span>
            </div>
            <div>
              <span className="user-detail-label">Last LDAP sync</span>
              <span className="user-detail-value">{formatDate(user.ldapSyncedAt)}</span>
            </div>
            {user.orgSyncedAt ? (
              <div>
                <span className="user-detail-label">Last org sync</span>
                <span className="user-detail-value">{formatDate(user.orgSyncedAt)}</span>
              </div>
            ) : null}
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          variant="detail"
          title="Credentials"
          meta="Generated credentials, exports, and regeneration controls."
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
