import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  confirmOnboardingSetup,
  fetchCatalogItems,
  fetchDepartmentBundles,
  fetchPulseOrgHierarchy,
  fetchUsersForOnboarding,
  previewOnboardingSetup
} from "../onboarding-api.js";
import { previewImapPassword } from "../../credentials/api/credentials.js";
import { useActualPasswordPreview } from "../../credentials/hooks/useImapGenerator.js";
import { useToast } from "../../../shared/hooks/useToast.js";
import "../onboarding.css";
import "../new-joiner-page.css";

const STATUS_OPTIONS = ["", "Active", "Pending", "Suspended"];
const CATEGORY_OPTIONS = ["", "Staff", "Contractor", "Vendor"];
const WORK_EMAIL_DOMAIN = "jkseng.com";
const WORK_EMAIL_SUFFIX = `@${WORK_EMAIL_DOMAIN}`;

const defaultActualCharset = {
  uppercase: true,
  lowercase: true,
  digit: true,
  special: true
};

const ACTUAL_PASSWORD_LENGTH = 12;

/** Empty allowed; non-empty must match API email validation. */
const isOptionalEmailValid = (raw) => {
  const value = String(raw ?? "").trim();
  if (!value) {
    return true;
  }
  return z.string().email().safeParse(value).success;
};

const getErrorMessage = (error, fallback = "Something went wrong.") => {
  return error?.problemDetails?.detail || error?.message || fallback;
};

const getWorkEmailLocalPart = (email) => {
  const value = String(email ?? "").trim();
  if (!value) {
    return "";
  }

  const at = value.indexOf("@");
  if (at < 0) {
    return value;
  }

  return value.slice(0, at);
};

const normalizeWorkEmailInput = (raw) => {
  const value = String(raw ?? "").trim();
  if (!value) {
    return { email: "", error: "" };
  }

  const at = value.indexOf("@");
  if (at < 0) {
    return { email: `${value}${WORK_EMAIL_SUFFIX}`, error: "" };
  }

  const localPart = value.slice(0, at).trim();
  const domain = value.slice(at + 1).trim().toLowerCase();
  const error = domain && domain !== WORK_EMAIL_DOMAIN
    ? `Only ${WORK_EMAIL_SUFFIX} email addresses are allowed.`
    : "";

  return {
    email: localPart ? `${localPart}${WORK_EMAIL_SUFFIX}` : "",
    error
  };
};

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

/** Work-email local part without dots, title-cased + @7189 (e.g. abu.ali@jkseng.com → Abuali@7189). */
const deriveActiveDirectoryFromEmail = (email) => {
  const trimmed = String(email ?? "")
    .trim()
    .toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0) {
    return "";
  }
  const local = trimmed.slice(0, at).replace(/\./g, "");
  const cleaned = local.replace(/[^a-z0-9]/g, "");
  if (!cleaned) {
    return "";
  }
  const cased = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  return `${cased}@7189`;
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

export function NewJoinerPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [mode, setMode] = useState("manual");
  const [selectedUserId, setSelectedUserId] = useState("");

  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [dob, setDob] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [actualPassword, setActualPassword] = useState("");
  const [ipadMail, setIpadMail] = useState("");
  const [macMail, setMacMail] = useState("");
  const [iphoneMail, setIphoneMail] = useState("");
  const [outlookDesktop, setOutlookDesktop] = useState("");
  const [outlookIos, setOutlookIos] = useState("");
  const [outlookAndroid, setOutlookAndroid] = useState("");
  const [androidPassword, setAndroidPassword] = useState("");
  const [remarks, setRemarks] = useState("");

  const [imapPassword, setImapPassword] = useState("");
  const [imapUsername, setImapUsername] = useState("");
  const [credentialError, setCredentialError] = useState("");
  const [imapPreviewBusy, setImapPreviewBusy] = useState(false);

  const [manualIdentity, setManualIdentity] = useState({
    fullName: "",
    email: "",
    department: ""
  });
  const [workEmailError, setWorkEmailError] = useState("");
  const [department, setDepartment] = useState("");
  const [manualPulseDivisionId, setManualPulseDivisionId] = useState("");
  const [manualPulseDepartmentId, setManualPulseDepartmentId] = useState("");
  const [manualPulseSectionId, setManualPulseSectionId] = useState("");
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

  const pulseOrgQuery = useQuery({
    queryKey: ["onboarding", "pulse-org-hierarchy"],
    queryFn: fetchPulseOrgHierarchy
  });

  const usersQuery = useQuery({
    queryKey: ["onboarding", "directory-users"],
    queryFn: () => fetchUsersForOnboarding("")
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
      queryClient.invalidateQueries({ queryKey: ["onboarding", "directory-users"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User added", "The user and onboarding credentials were saved successfully.");
    },
    onError: (error) => {
      toast.error("Add user failed", getErrorMessage(error, "Unable to save onboarding user."));
    }
  });

  const actualPreviewMutation = useActualPasswordPreview();
  const actualPreviewMutateRef = useRef(actualPreviewMutation.mutate);

  useEffect(() => {
    actualPreviewMutateRef.current = actualPreviewMutation.mutate;
  }, [actualPreviewMutation.mutate]);

  const catalogItems = catalogItemsQuery.data ?? [];
  const bundles = bundlesQuery.data ?? [];
  const users = usersQuery.data ?? [];
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
    if (!manualPulseDivisionId) {
      return all;
    }
    return all.filter((d) => d.divisionId === manualPulseDivisionId);
  }, [pulseHierarchy.departments, manualPulseDivisionId]);
  const sectionsInSelectedDepartment = useMemo(() => {
    if (!manualPulseDepartmentId) {
      return [];
    }
    return (pulseHierarchy.sections ?? []).filter((s) => s.departmentId === manualPulseDepartmentId);
  }, [pulseHierarchy.sections, manualPulseDepartmentId]);
  const departmentOptions = useMemo(
    () => bundles.filter((bundle) => bundle.isActive).map((bundle) => bundle.department),
    [bundles]
  );
  const manualPreviewReady = useMemo(() => {
    if (mode !== "manual") {
      return true;
    }
    const name = manualIdentity.fullName.trim();
    const email = manualIdentity.email.trim();
    return (
      Boolean(name) &&
      Boolean(email) &&
      z.string().email().safeParse(email).success &&
      /^\d{4}-\d{2}-\d{2}$/.test(dob.trim())
    );
  }, [mode, manualIdentity.fullName, manualIdentity.email, dob]);
  const canSubmitOnboarding = useMemo(() => {
    if (mode === "manual") {
      return (
        manualPreviewReady &&
        Boolean(actualPassword) &&
        Boolean(imapPassword) &&
        !actualPreviewMutation.isPending &&
        !imapPreviewBusy
      );
    }
    return Boolean(selectedUserId);
  }, [
    actualPassword,
    actualPreviewMutation.isPending,
    imapPassword,
    imapPreviewBusy,
    manualPreviewReady,
    mode,
    selectedUserId
  ]);

  const resolvedDepartment = mode === "existing_user" ? department : manualIdentity.department;
  const setupSheet = confirmedResult?.setupSheet ?? previewResult?.setupSheet ?? null;
  const selectedDirectoryUser = useMemo(
    () => users.find((entry) => entry.id === selectedUserId) ?? null,
    [users, selectedUserId]
  );
  const derivedActiveDirectory = useMemo(
    () => deriveActiveDirectoryFromEmail(manualIdentity.email),
    [manualIdentity.email]
  );
  const workEmailLocalPart = useMemo(
    () => getWorkEmailLocalPart(manualIdentity.email),
    [manualIdentity.email]
  );
  const pulseOrg = selectedDirectoryUser?.pulseOrg ?? {
    division: "",
    department: "",
    section: ""
  };

  const actualCharsetEnabledCount = useMemo(
    () =>
      [
        defaultActualCharset.uppercase,
        defaultActualCharset.lowercase,
        defaultActualCharset.digit,
        defaultActualCharset.special
      ].filter(Boolean).length,
    []
  );

  const canPreviewActualPassword = useMemo(() => {
    if (actualCharsetEnabledCount <= 0 || ACTUAL_PASSWORD_LENGTH < actualCharsetEnabledCount) {
      return false;
    }
    return isOptionalEmailValid(manualIdentity.email);
  }, [manualIdentity.email, actualCharsetEnabledCount]);

  const actualPreviewPayload = useMemo(
    () => ({
      fullName: manualIdentity.fullName,
      email: manualIdentity.email,
      dob: dob || "",
      temporaryPassword,
      length: ACTUAL_PASSWORD_LENGTH,
      charset: defaultActualCharset
    }),
    [manualIdentity.fullName, manualIdentity.email, dob, temporaryPassword]
  );

  const canPreviewImapPassword = useMemo(() => {
    const hasIdentity =
      Boolean(manualIdentity.fullName.trim()) &&
      Boolean(manualIdentity.email.trim()) &&
      isOptionalEmailValid(manualIdentity.email);
    const hasDob = /^\d{4}-\d{2}-\d{2}$/.test(dob.trim());
    if (mode === "existing_user") {
      return Boolean(selectedUserId) && hasIdentity && hasDob;
    }
    return hasIdentity && hasDob;
  }, [dob, manualIdentity.email, manualIdentity.fullName, mode, selectedUserId]);

  const imapPreviewPayload = useMemo(() => {
    const baseInputs = {
      email: manualIdentity.email.trim(),
      fullName: manualIdentity.fullName.trim(),
      dob: dob || "",
      temporaryPassword,
      firstName: "",
      lastName: "",
      phone: ""
    };

    const selectedFields = {
      email: true,
      fullName: true,
      dob: true,
      temporaryPassword: true
    };

    if (mode === "existing_user" && selectedUserId) {
      return {
        userId: selectedUserId,
        inputs: baseInputs,
        selectedFields
      };
    }

    return {
      manualIdentity: {
        fullName: manualIdentity.fullName.trim(),
        email: manualIdentity.email.trim()
      },
      inputs: baseInputs,
      selectedFields
    };
  }, [dob, manualIdentity.email, manualIdentity.fullName, mode, selectedUserId, temporaryPassword]);

  useEffect(() => {
    if (!canPreviewActualPassword) {
      setActualPassword("");
      return;
    }

    const timer = window.setTimeout(() => {
      actualPreviewMutateRef.current(actualPreviewPayload, {
        onSuccess: (data) => {
          if (data?.password) {
            setActualPassword(data.password);
          }
        },
        onError: () => {
          setActualPassword("");
        }
      });
    }, 200);

    return () => window.clearTimeout(timer);
  }, [actualPreviewPayload, canPreviewActualPassword]);

  useEffect(() => {
    if (!canPreviewImapPassword) {
      setImapPassword("");
      setImapUsername("");
      setCredentialError("");
      setImapPreviewBusy(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setImapPreviewBusy(true);
      setCredentialError("");
      try {
        const body = await previewImapPassword(imapPreviewPayload);
        if (cancelled) {
          return;
        }
        const proposed = body?.data?.proposedCredential;
        setImapPassword(proposed?.password || "");
        setImapUsername(proposed?.username || "");
      } catch (e) {
        if (cancelled) {
          return;
        }
        setImapPassword("");
        setImapUsername("");
        setCredentialError(e.message || "Could not preview IMAP app password.");
      } finally {
        if (!cancelled) {
          setImapPreviewBusy(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canPreviewImapPassword, imapPreviewPayload]);

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
    if (mode !== "manual" || !pulseHierarchy.enabled || !(pulseHierarchy.departments ?? []).length) {
      return;
    }
    const name = manualIdentity.department?.trim();
    if (!name) {
      setManualPulseDivisionId("");
      setManualPulseDepartmentId("");
      setManualPulseSectionId("");
      return;
    }
    const match = pulseHierarchy.departments.find(
      (d) => d.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (!match) {
      return;
    }
    setManualPulseDivisionId(match.divisionId ?? "");
    setManualPulseDepartmentId(match.id);
  }, [mode, pulseHierarchy.enabled, pulseHierarchy.departments, manualIdentity.department]);

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

    if (selectedUser) {
      setManualIdentity((prev) => ({
        ...prev,
        fullName: selectedUser.displayName || selectedUser.username || "",
        email: selectedUser.email || ""
      }));
      setWorkEmailError("");
    }
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

  const handleWorkEmailChange = (rawValue) => {
    const normalized = normalizeWorkEmailInput(rawValue);
    setWorkEmailError(normalized.error);
    setManualIdentity((current) => ({ ...current, email: normalized.email }));
  };

  const handleManualPulseDivisionChange = (nextDivisionId) => {
    setManualPulseDivisionId(nextDivisionId);
    setManualPulseDepartmentId("");
    setManualPulseSectionId("");
    handleManualDepartmentChange("");
  };

  const handleManualPulseDepartmentChange = (nextDepartmentId) => {
    setManualPulseDepartmentId(nextDepartmentId);
    setManualPulseSectionId("");
    const dept = (pulseHierarchy.departments ?? []).find((d) => d.id === nextDepartmentId);
    handleManualDepartmentChange(dept?.name ?? "");
  };

  const handleManualPulseSectionChange = (nextSectionId) => {
    setManualPulseSectionId(nextSectionId);
  };

  const handleExistingUserChange = (nextUserId) => {
    const selectedUser = users.find((entry) => entry.id === nextUserId);

    setSelectedUserId(nextUserId);
    if (selectedUser) {
      setDepartment(selectedUser.department ?? "");
      setManualIdentity((prev) => ({
        ...prev,
        fullName: selectedUser.displayName || selectedUser.username || "",
        email: selectedUser.email || ""
      }));
      setWorkEmailError("");
      setSelectedItemKeys((current) =>
        syncSelection(current, getRecommendedItemKeys(bundles, selectedUser.department ?? ""))
      );
    }
  };

  const resetFormExtras = () => {
    setStatus("");
    setCategory("");
    setDob("");
    setTemporaryPassword("");
    setActualPassword("");
    setImapPassword("");
    setImapUsername("");
    setIpadMail("");
    setMacMail("");
    setIphoneMail("");
    setOutlookDesktop("");
    setOutlookIos("");
    setOutlookAndroid("");
    setAndroidPassword("");
    setRemarks("");
    setCredentialError("");
  };

  const buildPreviewPayload = () => {
    const profileFields = {
      name: manualIdentity.fullName.trim(),
      email: manualIdentity.email.trim(),
      date: dob.trim(),
      "temporary-password": temporaryPassword,
      "actual-password": actualPassword,
      "android-password": androidPassword,
      "iphone-mail": iphoneMail,
      "ipad-mail": ipadMail,
      "mac-mail": macMail,
      "outlook-ios": outlookIos,
      "outlook-android": outlookAndroid,
      "outlook-desktop": outlookDesktop,
      "active-directory": derivedActiveDirectory,
      status,
      category,
      remarks
    };
    const payload = {
      mode,
      selectedCatalogItemKeys: [...selectedItemKeys],
      supplementalCredentials: {
        actualPassword,
        profileFields,
        imap: {
          username: imapUsername || manualIdentity.email.trim(),
          password: imapPassword,
          inputs: imapPreviewPayload.inputs,
          selectedFields: imapPreviewPayload.selectedFields
        }
      }
    };

    if (mode === "existing_user") {
      payload.userId = selectedUserId;
    } else {
      payload.manualIdentity = {
        ...manualIdentity,
        department: manualIdentity.department,
        dob: dob.trim(),
        pulseOrg: getSelectedPulseOrg({
          hierarchy: pulseHierarchy,
          divisionId: manualPulseDivisionId,
          departmentId: manualPulseDepartmentId,
          sectionId: manualPulseSectionId
        })
      };
    }

    return payload;
  };

  const handlePreview = () => {
    previewMutation.mutate(buildPreviewPayload());
  };

  const handleConfirm = async () => {
    if (!canSubmitOnboarding || previewMutation.isPending || confirmMutation.isPending) {
      return;
    }

    let previewToken = previewResult?.previewToken;
    if (!previewToken) {
      try {
        const preview = await previewMutation.mutateAsync(buildPreviewPayload());
        previewToken = preview?.previewToken;
      } catch (error) {
        toast.error("Add user failed", getErrorMessage(error, "Unable to preview onboarding setup."));
        return;
      }
    }

    if (!previewToken) {
      toast.error("Add user failed", "Preview did not return a save token.");
      return;
    }

    confirmMutation.mutate({
      previewToken,
      confirmed: true
    });
  };

  const handleCancel = () => {
    setMode("manual");
    setSelectedUserId("");
    setManualIdentity({ fullName: "", email: "", department: "" });
    setWorkEmailError("");
    setDepartment("");
    setManualPulseDivisionId("");
    setManualPulseDepartmentId("");
    setManualPulseSectionId("");
    setSelectedItemKeys(new Set());
    setPreviewResult(null);
    setConfirmedResult(null);
    resetFormExtras();
  };

  const identityLocked = mode === "existing_user";

  return (
    <div className="nj-shell">
      <section className="nj-hero">
        <h1 className="nj-hero-bar">Add New User</h1>
        <div className="nj-hero-body">
          <div className="nj-identity-row">
            <label className="nj-mode-option">
              <input
                type="radio"
                name="nj-mode"
                checked={mode === "manual"}
                onChange={() => {
                  setMode("manual");
                  setSelectedUserId("");
                  setWorkEmailError("");
                  setPreviewResult(null);
                  setConfirmedResult(null);
                }}
              />
              Manual entry
            </label>
            <label className="nj-mode-option">
              <input
                type="radio"
                name="nj-mode"
                checked={mode === "existing_user"}
                onChange={() => {
                  setMode("existing_user");
                  setWorkEmailError("");
                  setPreviewResult(null);
                  setConfirmedResult(null);
                }}
              />
              Directory user
            </label>
            {mode === "existing_user" ? (
              <div className="nj-directory-wrap">
                <label htmlFor="nj-directory-user">Linked account</label>
                <select
                  id="nj-directory-user"
                  aria-label="Linked account"
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
            ) : null}
          </div>

          <div className="nj-erp-form">
            <div className="nj-erp-section">
              <div className="nj-erp-section-head">
                <h3 className="nj-erp-section-title">Person &amp; account</h3>
              </div>
              <div className="nj-erp-rows">
                <div className="nj-erp-row">
                  <div className="nj-field">
                    <label htmlFor="nj-name">Name (required)</label>
                    <input
                      id="nj-name"
                      value={manualIdentity.fullName}
                      readOnly={identityLocked}
                      className={identityLocked ? "nj-field-readonly" : undefined}
                      onChange={(e) =>
                        setManualIdentity((c) => ({ ...c, fullName: e.target.value }))
                      }
                      placeholder="Full name"
                    />
                  </div>
                  <div className="nj-field">
                    <label htmlFor="nj-email">Work email (required)</label>
                    <div
                      className={`nj-email-combo${identityLocked ? " nj-field-readonly" : ""}`}
                    >
                      <input
                        id="nj-email"
                        type="text"
                        inputMode="email"
                        autoCapitalize="none"
                        autoComplete="off"
                        value={workEmailLocalPart}
                        readOnly={identityLocked}
                        onChange={(e) => handleWorkEmailChange(e.target.value)}
                        placeholder="user.name"
                        aria-describedby={workEmailError ? "nj-email-error" : undefined}
                      />
                      <span className="nj-email-suffix" aria-hidden="true">
                        {WORK_EMAIL_SUFFIX}
                      </span>
                    </div>
                    {workEmailError ? (
                      <p id="nj-email-error" className="nj-field-error">
                        {workEmailError}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="nj-erp-row">
                  <div className="nj-field">
                    <label htmlFor="nj-dob">Date of birth (required)</label>
                    <input
                      id="nj-dob"
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                    />
                  </div>
                  <div className="nj-field">
                    <label htmlFor="nj-temp-pw">Yahoo temporary password (optional)</label>
                    <input
                      id="nj-temp-pw"
                      type="text"
                      autoComplete="new-password"
                      value={temporaryPassword}
                      onChange={(e) => setTemporaryPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="nj-erp-section">
              <div className="nj-erp-section-head">
                <h3 className="nj-erp-section-title">Passwords</h3>
              </div>
              <div className="nj-erp-rows">
                <div className="nj-erp-row">
                  <div className="nj-field">
                    <label htmlFor="nj-actual-password">Actual password</label>
                    <input
                      id="nj-actual-password"
                      type="text"
                      autoComplete="off"
                      readOnly
                      className="nj-field-readonly"
                      value={actualPassword}
                      placeholder={actualPreviewMutation.isPending ? "Generating…" : "—"}
                      aria-busy={actualPreviewMutation.isPending}
                      aria-live="polite"
                    />
                    <p className="nj-field-helper">
                      IMAP app password generated separately (shown next). Stored as IT-only credential; excluded from exports.
                    </p>
                  </div>
                  <div className="nj-field">
                    <label htmlFor="nj-imap-password">IMAP app password</label>
                    <input
                      id="nj-imap-password"
                      type="text"
                      autoComplete="off"
                      readOnly
                      className="nj-field-readonly"
                      value={imapPassword}
                      placeholder={imapPreviewBusy ? "Generating..." : "-"}
                      aria-busy={imapPreviewBusy}
                      aria-live="polite"
                    />
                    {credentialError ? (
                      <p className="nj-field-error" role="alert">
                        {credentialError}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="nj-erp-row">
                  <div className="nj-field">
                    <label htmlFor="nj-android-pw">Android password (optional)</label>
                    <input
                      id="nj-android-pw"
                      value={androidPassword}
                      onChange={(e) => setAndroidPassword(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="nj-erp-section">
              <div className="nj-erp-section-head">
                <h3 className="nj-erp-section-title">Organization (JKSPulse)</h3>
              </div>
              <div className="nj-erp-rows">
                {mode === "existing_user" && selectedUserId ? (
                  <div className="nj-erp-row nj-erp-row-triple">
                    <div className="nj-field">
                      <span className="nj-erp-readonly-label">Division</span>
                      <div id="nj-pulse-division" className="nj-erp-readonly-value" title={pulseOrg.division || undefined}>
                        {pulseOrg.division || "—"}
                      </div>
                    </div>
                    <div className="nj-field">
                      <span className="nj-erp-readonly-label">Department</span>
                      <div id="nj-pulse-department" className="nj-erp-readonly-value" title={pulseOrg.department || undefined}>
                        {pulseOrg.department || "—"}
                      </div>
                    </div>
                    <div className="nj-field">
                      <span className="nj-erp-readonly-label">Section</span>
                      <div id="nj-pulse-section" className="nj-erp-readonly-value" title={pulseOrg.section || undefined}>
                        {pulseOrg.section || "—"}
                      </div>
                    </div>
                  </div>
                ) : null}
                {mode === "manual" && pulseHierarchy.enabled ? (
                  <div className="nj-erp-row nj-erp-row-triple">
                    <div className="nj-field">
                      <label htmlFor="nj-pulse-manual-division">Division (optional)</label>
                      <select
                        id="nj-pulse-manual-division"
                        aria-label="Division (JKSPulse, optional)"
                        value={manualPulseDivisionId}
                        onChange={(event) => handleManualPulseDivisionChange(event.target.value)}
                        disabled={pulseOrgQuery.isLoading}
                      >
                        <option value="">Select division</option>
                        {(pulseHierarchy.divisions ?? []).map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="nj-field">
                      <label htmlFor="nj-pulse-manual-department">Department (optional)</label>
                      <select
                        id="nj-pulse-manual-department"
                        aria-label="Department (JKSPulse, optional)"
                        value={manualPulseDepartmentId}
                        onChange={(event) => handleManualPulseDepartmentChange(event.target.value)}
                        disabled={pulseOrgQuery.isLoading || !departmentsInSelectedDivision.length}
                      >
                        <option value="">Select department</option>
                        {departmentsInSelectedDivision.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="nj-field">
                      <label htmlFor="nj-pulse-manual-section">Section (optional)</label>
                      <select
                        id="nj-pulse-manual-section"
                        aria-label="Section (JKSPulse, optional)"
                        value={manualPulseSectionId}
                        onChange={(event) => handleManualPulseSectionChange(event.target.value)}
                        disabled={
                          pulseOrgQuery.isLoading ||
                          !manualPulseDepartmentId ||
                          !sectionsInSelectedDepartment.length
                        }
                      >
                        <option value="">
                          {!manualPulseDepartmentId
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
                    </div>
                  </div>
                ) : null}
                {mode === "manual" && !pulseHierarchy.enabled && !pulseOrgQuery.isLoading ? (
                  <div className="nj-erp-row">
                    <div className="nj-field nj-field-span">
                      <label htmlFor="nj-department">Department (application bundle, optional)</label>
                      <select
                        id="nj-department"
                        aria-label="Department (application bundle, optional)"
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
                ) : null}
                {mode === "manual" && pulseOrgQuery.isLoading ? (
                  <div className="nj-erp-row">
                    <div className="nj-field nj-field-span">
                      <span className="nj-erp-readonly-label">JKSPulse</span>
                      <div className="nj-erp-readonly-value">Loading organization…</div>
                    </div>
                  </div>
                ) : null}
                {mode === "manual" && pulseOrgQuery.isError ? (
                  <p className="nj-cred-error" role="alert">
                    Could not load JKSPulse organization. Use bundle list below if shown, or try again.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="nj-erp-section">
              <div className="nj-erp-section-head">
                <h3 className="nj-erp-section-title">Classification</h3>
              </div>
              <div className="nj-erp-rows">
                <div className="nj-erp-row">
                  <div className="nj-field">
                    <label htmlFor="nj-status">Status</label>
                    <select id="nj-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt || "empty-s"} value={opt}>
                          {opt || "—"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="nj-field">
                    <label htmlFor="nj-category">Category</label>
                    <select id="nj-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt || "empty-c"} value={opt}>
                          {opt || "—"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="nj-erp-section">
              <div className="nj-erp-section-head">
                <h3 className="nj-erp-section-title">Mail &amp; Outlook</h3>
              </div>
              <div className="nj-erp-rows">
                <div className="nj-erp-row">
                  <div className="nj-field">
                    <label htmlFor="nj-iphone-mail">iPhone mail (optional)</label>
                    <input
                      id="nj-iphone-mail"
                      value={iphoneMail}
                      onChange={(e) => setIphoneMail(e.target.value)}
                    />
                  </div>
                  <div className="nj-field">
                    <label htmlFor="nj-ipad-mail">iPad mail (optional)</label>
                    <input id="nj-ipad-mail" value={ipadMail} onChange={(e) => setIpadMail(e.target.value)} />
                  </div>
                </div>
                <div className="nj-erp-row">
                  <div className="nj-field">
                    <label htmlFor="nj-mac-mail">Mac mail (optional)</label>
                    <input id="nj-mac-mail" value={macMail} onChange={(e) => setMacMail(e.target.value)} />
                  </div>
                  <div className="nj-field">
                    <label htmlFor="nj-outlook-ios">Outlook iOS (optional)</label>
                    <input id="nj-outlook-ios" value={outlookIos} onChange={(e) => setOutlookIos(e.target.value)} />
                  </div>
                </div>
                <div className="nj-erp-row">
                  <div className="nj-field">
                    <label htmlFor="nj-outlook-android">Outlook Android (optional)</label>
                    <input
                      id="nj-outlook-android"
                      value={outlookAndroid}
                      onChange={(e) => setOutlookAndroid(e.target.value)}
                    />
                  </div>
                  <div className="nj-field">
                    <label htmlFor="nj-outlook-desktop">Outlook desktop</label>
                    <input
                      id="nj-outlook-desktop"
                      value={outlookDesktop}
                      onChange={(e) => setOutlookDesktop(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="nj-erp-section">
              <div className="nj-erp-section-head">
                <h3 className="nj-erp-section-title">Directory sign-in</h3>
              </div>
              <div className="nj-erp-rows">
                <div className="nj-erp-row">
                  <div className="nj-field nj-field-span">
                    <label htmlFor="nj-ad">Active Directory (samAccountName)</label>
                    <input
                      id="nj-ad"
                      readOnly
                      className="nj-field-readonly"
                      value={derivedActiveDirectory}
                      placeholder="Enter a work email to derive (e.g. Abuali@7189)"
                      aria-live="polite"
                    />
                  </div>
                  <div className="nj-field nj-field-span">
                    <label htmlFor="nj-remarks">Remarks (optional)</label>
                    <textarea id="nj-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="nj-footer-actions">
            <button
              type="button"
              className="nj-btn nj-btn-primary"
              onClick={handleConfirm}
              disabled={previewMutation.isPending || confirmMutation.isPending || !canSubmitOnboarding}
            >
              {previewMutation.isPending || confirmMutation.isPending ? "Saving…" : "Add User"}
            </button>
            <button type="button" className="nj-btn nj-btn-primary" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      </section>

      <section className="nj-section">
        <h2>Application access</h2>
        <p className="nj-section-sub">
          {mode === "manual" && !resolvedDepartment
            ? "Optional: set JKSPulse, department bundle, or tick apps below. If none are ticked, preview includes every catalog app."
            : resolvedDepartment
              ? `${resolvedDepartment} bundle preselected ${selectedItemKeys.size} item(s). If none are ticked, preview includes every catalog app.`
              : pulseHierarchy.enabled
                ? "Choose division and department from JKSPulse (manual), or a directory user to load defaults."
                : "Pick a department bundle (manual) or a directory user to load default applications."}
        </p>
        <div className="nj-selection-grid">
          {catalogItems.map((item) => (
            <div key={item.id} className="nj-selection-card">
              <label htmlFor={`nj-catalog-${item.itemKey}`}>
                <input
                  id={`nj-catalog-${item.itemKey}`}
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
      </section>

      <section className="nj-section">
        <h2>Onboarding package</h2>
        <p className="nj-section-sub">Preview generated app credentials, then create the user and save the credentials.</p>
        <div className="nj-setup-actions">
          <button
            className="nj-btn nj-btn-secondary"
            type="button"
            onClick={handlePreview}
            disabled={
              previewMutation.isPending ||
              (mode === "manual" && !manualPreviewReady)
            }
          >
            Preview setup sheet
          </button>
        </div>
        {previewMutation.error ? <p className="nj-cred-error">{previewMutation.error.message}</p> : null}
        {confirmMutation.error ? <p className="nj-cred-error">{confirmMutation.error.message}</p> : null}

        {!setupSheet?.entries?.length ? (
          <div className="nj-empty">Run preview to fill usernames, passwords, and handoff notes for each app.</div>
        ) : (
          <table className="nj-setup-table">
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
      </section>
    </div>
  );
}
