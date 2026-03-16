import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  confirmOnboardingSetup,
  fetchCatalogItems,
  fetchOnboardingDrafts,
  fetchDepartmentBundles,
  fetchUsersForOnboarding,
  linkAndPromoteOnboardingDraft,
  previewOnboardingSetup
} from "../onboarding-api.js";
import "../onboarding.css";

const getRecommendedItemKeys = (bundles, department) => {
  const normalizedDepartment = department.trim().toLowerCase();
  if (!normalizedDepartment) {
    return [];
  }

  const bundle = bundles.find(
    (entry) => entry.department.trim().toLowerCase() === normalizedDepartment && entry.isActive
  );
  return bundle?.catalogItemKeys ?? [];
};

const syncSelection = (currentSelection, nextKeys) => {
  const nextSelection = new Set(nextKeys);
  if (
    currentSelection.size === nextSelection.size &&
    [...currentSelection].every((itemKey) => nextSelection.has(itemKey))
  ) {
    return currentSelection;
  }

  return nextSelection;
};

const formatDraftDate = (value) => {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
};

const buildSetupSheetCopy = (setupSheet) => {
  return (setupSheet?.entries ?? [])
    .map((entry) =>
      [
        entry.label,
        `URL: ${entry.loginUrl}`,
        `Username: ${entry.username}`,
        `Password: ${entry.password}`,
        `Notes: ${entry.notes || "-"}`
      ].join("\n")
    )
    .join("\n\n");
};

export function NewJoinerPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState("manual");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [linkingDraftId, setLinkingDraftId] = useState(null);
  const [linkTargetUserId, setLinkTargetUserId] = useState("");
  const [manualIdentity, setManualIdentity] = useState({
    fullName: "",
    email: "",
    department: ""
  });
  const [department, setDepartment] = useState("");
  const [selectedItemKeys, setSelectedItemKeys] = useState(new Set());
  const [previewResult, setPreviewResult] = useState(null);
  const [confirmedResult, setConfirmedResult] = useState(null);

  const catalogItemsQuery = useQuery({
    queryKey: ["onboarding", "catalog-items"],
    queryFn: fetchCatalogItems
  });

  const bundlesQuery = useQuery({
    queryKey: ["onboarding", "department-bundles"],
    queryFn: fetchDepartmentBundles
  });

  const usersQuery = useQuery({
    queryKey: ["onboarding", "directory-users"],
    queryFn: () => fetchUsersForOnboarding("")
  });

  const draftsQuery = useQuery({
    queryKey: ["onboarding", "drafts"],
    queryFn: () => fetchOnboardingDrafts("all")
  });

  const previewMutation = useMutation({
    mutationFn: previewOnboardingSetup,
    onSuccess: (data) => {
      setPreviewResult(data);
      setConfirmedResult(null);
    }
  });

  const confirmMutation = useMutation({
    mutationFn: confirmOnboardingSetup,
    onSuccess: (data) => {
      setConfirmedResult(data);
      if (data?.draftId) {
        setActiveDraftId(data.draftId);
      }
      queryClient.invalidateQueries({ queryKey: ["onboarding", "drafts"] });
    }
  });

  const linkMutation = useMutation({
    mutationFn: ({ draftId, userId }) => linkAndPromoteOnboardingDraft(draftId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding", "drafts"] });
      setLinkingDraftId(null);
      setLinkTargetUserId("");
    }
  });

  const catalogItems = catalogItemsQuery.data ?? [];
  const bundles = bundlesQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const drafts = draftsQuery.data ?? [];
  const departmentOptions = useMemo(
    () => bundles.filter((bundle) => bundle.isActive).map((bundle) => bundle.department),
    [bundles]
  );
  const resolvedDepartment = mode === "existing_user" ? department : manualIdentity.department;
  const setupSheet = confirmedResult?.setupSheet ?? previewResult?.setupSheet ?? null;

  useEffect(() => {
    if (mode !== "manual") {
      return;
    }

    const recommendedKeys = getRecommendedItemKeys(bundles, manualIdentity.department);
    setDepartment((current) =>
      current === manualIdentity.department ? current : manualIdentity.department
    );
    setSelectedItemKeys((current) => syncSelection(current, recommendedKeys));
  }, [bundles, manualIdentity.department, mode]);

  useEffect(() => {
    if (mode !== "existing_user") {
      return;
    }

    const selectedUser = users.find((entry) => entry.id === selectedUserId);
    const nextDepartment = selectedUser?.department ?? "";
    setDepartment((current) => (current === nextDepartment ? current : nextDepartment));
    setSelectedItemKeys((current) =>
      syncSelection(current, getRecommendedItemKeys(bundles, nextDepartment))
    );
  }, [bundles, mode, selectedUserId, users]);

  const toggleSelection = (itemKey) => {
    setSelectedItemKeys((current) => {
      const next = new Set(current);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
  };

  const handleManualDepartmentChange = (nextDepartment) => {
    setManualIdentity((current) => ({ ...current, department: nextDepartment }));
    setDepartment(nextDepartment);
    setSelectedItemKeys((current) =>
      syncSelection(current, getRecommendedItemKeys(bundles, nextDepartment))
    );
  };

  const handleExistingUserChange = (nextUserId) => {
    const selectedUser = users.find((entry) => entry.id === nextUserId);
    const nextDepartment = selectedUser?.department ?? "";

    setSelectedUserId(nextUserId);
    setDepartment(nextDepartment);
    setSelectedItemKeys((current) =>
      syncSelection(current, getRecommendedItemKeys(bundles, nextDepartment))
    );
  };

  const handlePreview = () => {
    const payload = {
      mode,
      selectedCatalogItemKeys: [...selectedItemKeys]
    };

    if (mode === "existing_user") {
      payload.userId = selectedUserId;
    } else {
      if (activeDraftId) {
        payload.draftId = activeDraftId;
      }
      payload.manualIdentity = {
        ...manualIdentity,
        department: manualIdentity.department
      };
    }

    previewMutation.mutate(payload);
  };

  const handleConfirm = () => {
    if (!previewResult?.previewToken) {
      return;
    }

    confirmMutation.mutate({
      previewToken: previewResult.previewToken,
      confirmed: true
    });
  };

  const handleOpenDraft = (draft) => {
    setMode("manual");
    setSelectedUserId("");
    setActiveDraftId(draft.id);
    setManualIdentity({
      fullName: draft.fullName,
      email: draft.email,
      department: draft.department
    });
    setDepartment(draft.department);
    setSelectedItemKeys(new Set(draft.selectedCatalogItemKeys ?? []));
    setPreviewResult({
      previewToken: null,
      recommendedItemKeys: draft.selectedCatalogItemKeys ?? [],
      setupSheet: draft.setupSheet
    });
    setConfirmedResult({
      draftId: draft.id,
      setupSheet: draft.setupSheet
    });
  };

  const handleCopySetupSheet = async (setupSheetToCopy) => {
    const copyValue = buildSetupSheetCopy(setupSheetToCopy);
    if (!copyValue) {
      return;
    }

    await navigator.clipboard?.writeText?.(copyValue);
  };

  const handleLinkDraft = (draftId) => {
    if (!linkTargetUserId) {
      return;
    }

    linkMutation.mutate({
      draftId,
      userId: linkTargetUserId
    });
  };

  return (
    <div className="onboarding-panel">
      <article className="onboarding-card">
        <div className="onboarding-card-header">
          <div>
            <h2>New Joiner Setup</h2>
            <p className="onboarding-card-subtitle">
              Pick a joiner source, auto-apply the department bundle, then adjust the final app
              list before saving.
            </p>
          </div>
          {resolvedDepartment ? <span className="onboarding-badge">{resolvedDepartment}</span> : null}
        </div>

        <div className="onboarding-mode-switch">
          <label className="onboarding-mode-option">
            <input
              type="radio"
              name="onboarding-mode"
              checked={mode === "manual"}
              onChange={() => {
                setMode("manual");
                setSelectedUserId("");
                setPreviewResult(null);
                setConfirmedResult(null);
              }}
            />
            Manual Joiner
          </label>
          <label className="onboarding-mode-option">
            <input
              type="radio"
              name="onboarding-mode"
              checked={mode === "existing_user"}
              onChange={() => {
                setMode("existing_user");
                setActiveDraftId(null);
                setPreviewResult(null);
                setConfirmedResult(null);
              }}
            />
            Existing Directory User
          </label>
        </div>

        {mode === "manual" ? (
          <div className="onboarding-form-grid">
            <div className="onboarding-form-field">
              <label htmlFor="manual-full-name">Full Name</label>
              <input
                id="manual-full-name"
                value={manualIdentity.fullName}
                onChange={(event) =>
                  setManualIdentity((current) => ({ ...current, fullName: event.target.value }))
                }
                placeholder="Haziq Afendi"
              />
            </div>

            <div className="onboarding-form-field">
              <label htmlFor="manual-email">Email</label>
              <input
                id="manual-email"
                value={manualIdentity.email}
                onChange={(event) =>
                  setManualIdentity((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="haziq.afendi@jkseng.com"
              />
            </div>

            <div className="onboarding-form-field">
              <label htmlFor="manual-department">Department</label>
              <select
                id="manual-department"
                aria-label="Department"
                value={manualIdentity.department}
                onChange={(event) => handleManualDepartmentChange(event.target.value)}
              >
                <option value="">Select department</option>
                {departmentOptions.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="onboarding-form-grid">
            <div className="onboarding-form-field">
              <label htmlFor="existing-user-select">Existing User</label>
              <select
                id="existing-user-select"
                aria-label="Existing User"
                value={selectedUserId}
                onChange={(event) => handleExistingUserChange(event.target.value)}
              >
                <option value="">Select directory user</option>
                {users.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.displayName || entry.username}
                  </option>
                ))}
              </select>
            </div>

            <div className="onboarding-form-field">
              <label htmlFor="existing-department">Department</label>
              <input id="existing-department" value={department} readOnly />
            </div>
          </div>
        )}
      </article>

      <article className="onboarding-card">
        <div className="onboarding-card-header">
          <div>
            <h2>Recommended App Bundle</h2>
            <p className="onboarding-card-subtitle">
              Department rules preselect apps, but you can still add or remove anything before
              saving.
            </p>
          </div>
          <span className="onboarding-badge">{selectedItemKeys.size} selected</span>
        </div>

        <div className="onboarding-selection-grid">
          {catalogItems.map((item) => (
            <div key={item.id} className="onboarding-selection-card">
              <label htmlFor={`catalog-${item.itemKey}`}>
                <input
                  id={`catalog-${item.itemKey}`}
                  type="checkbox"
                  aria-label={item.label}
                  checked={selectedItemKeys.has(item.itemKey)}
                  onChange={() => toggleSelection(item.itemKey)}
                />
                {item.label}
              </label>
              <p>{item.notes || item.loginUrl}</p>
            </div>
          ))}
        </div>

        <div className="onboarding-actions">
          <button
            className="onboarding-button"
            type="button"
            onClick={handlePreview}
            disabled={previewMutation.isPending || !selectedItemKeys.size}
          >
            Preview Setup Sheet
          </button>
          <button
            className="onboarding-button-secondary"
            type="button"
            onClick={handleConfirm}
            disabled={confirmMutation.isPending || !previewResult?.previewToken}
          >
            Save Onboarding Credentials
          </button>
        </div>

        {previewMutation.error ? <p className="onboarding-muted">{previewMutation.error.message}</p> : null}
        {confirmMutation.error ? <p className="onboarding-muted">{confirmMutation.error.message}</p> : null}
        {linkMutation.error ? <p className="onboarding-muted">{linkMutation.error.message}</p> : null}
      </article>

      <article className="onboarding-card">
        <div className="onboarding-card-header">
          <div>
            <h2>Setup Sheet</h2>
            <p className="onboarding-card-subtitle">
              Copy this into the assigned laptop handoff once the defaults and app list look right.
            </p>
          </div>
          {previewResult?.recommendedItemKeys?.length ? (
            <span className="onboarding-badge is-muted">
              Recommended: {previewResult.recommendedItemKeys.join(", ")}
            </span>
          ) : null}
        </div>

        {!setupSheet?.entries?.length ? (
          <div className="onboarding-empty">
            Preview the setup sheet to generate usernames, passwords, URLs, and notes.
          </div>
        ) : (
          <table className="onboarding-setup-table">
            <thead>
              <tr>
                <th>App</th>
                <th>URL</th>
                <th>Username</th>
                <th>Password</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {setupSheet.entries.map((entry) => (
                <tr key={entry.systemId}>
                  <td>{entry.label}</td>
                  <td>{entry.loginUrl}</td>
                  <td>{entry.username}</td>
                  <td>{entry.password}</td>
                  <td>{entry.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>

      <article className="onboarding-card">
        <div className="onboarding-card-header">
          <div>
            <h2>Saved Drafts</h2>
            <p className="onboarding-card-subtitle">
              Reopen manual onboarding drafts, copy their setup sheet, or link them to a real
              directory user later.
            </p>
          </div>
          <span className="onboarding-badge">{drafts.length} drafts</span>
        </div>

        {!drafts.length ? (
          <div className="onboarding-empty">
            No saved drafts yet. Manual onboarding confirmations will appear here.
          </div>
        ) : (
          <div className="onboarding-list">
            {drafts.map((draft) => (
              <div key={draft.id} className="onboarding-list-item">
                <div className="onboarding-list-item-header">
                  <div>
                    <p className="onboarding-list-item-title">{draft.fullName}</p>
                    <p className="onboarding-list-item-meta">
                      {draft.email} • {draft.department} • {formatDraftDate(draft.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`onboarding-badge${draft.status === "completed" ? "" : " is-muted"}`}
                  >
                    {draft.status === "completed" ? "Completed" : "Draft"}
                  </span>
                </div>

                <div className="onboarding-actions">
                  <button
                    className="onboarding-button-secondary"
                    type="button"
                    onClick={() => handleOpenDraft(draft)}
                  >
                    Open Draft
                  </button>
                  <button
                    className="onboarding-button-secondary"
                    type="button"
                    onClick={() => handleCopySetupSheet(draft.setupSheet)}
                  >
                    Copy Setup Sheet
                  </button>
                  {draft.status !== "completed" ? (
                    <button
                      className="onboarding-button"
                      type="button"
                      onClick={() => {
                        setLinkingDraftId(draft.id);
                        setLinkTargetUserId("");
                      }}
                    >
                      Link to Directory User
                    </button>
                  ) : null}
                </div>

                {linkingDraftId === draft.id ? (
                  <div className="onboarding-inline-panel">
                    <div className="onboarding-form-field">
                      <label htmlFor={`link-draft-${draft.id}`}>Link Draft To User</label>
                      <select
                        id={`link-draft-${draft.id}`}
                        aria-label="Link Draft To User"
                        value={linkTargetUserId}
                        onChange={(event) => setLinkTargetUserId(event.target.value)}
                      >
                        <option value="">Select directory user</option>
                        {users.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.displayName || entry.username}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="onboarding-actions">
                      <button
                        className="onboarding-button"
                        type="button"
                        onClick={() => handleLinkDraft(draft.id)}
                        disabled={linkMutation.isPending || !linkTargetUserId}
                      >
                        Confirm Link & Promote
                      </button>
                      <button
                        className="onboarding-button-secondary"
                        type="button"
                        onClick={() => {
                          setLinkingDraftId(null);
                          setLinkTargetUserId("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
