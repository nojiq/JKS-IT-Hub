import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { fetchUserDetail, fetchUsers, updateUserProfileFields } from "../../users/users-api.js";
import { useActualPasswordPreview } from "../hooks/useImapGenerator.js";
import IsoDatePopoverField from "./IsoDatePopoverField.jsx";

const defaultCharset = {
    uppercase: true,
    lowercase: true,
    digit: true,
    special: true
};

/** Prefer email for directory search when it looks like an address; otherwise name, then email. */
const buildUserSearchQuery = (fullName, email) => {
    const rawName = fullName.trim();
    const rawEmail = email.trim();
    if (rawEmail.includes("@")) {
        return rawEmail;
    }
    return rawName || rawEmail;
};

/** LDAP `mail` may be a string, array of strings, or other shapes from the API. */
const coerceMailString = (mail) => {
    if (mail == null || mail === "") {
        return "";
    }
    if (Array.isArray(mail)) {
        for (const entry of mail) {
            const s = String(entry ?? "").trim();
            if (s) {
                return s;
            }
        }
        return "";
    }
    if (typeof mail === "object") {
        return "";
    }
    return String(mail).trim();
};

const suggestionButtonLabel = (suggestion) => {
    const secondary = coerceMailString(suggestion.mail) || suggestion.username;
    return `${suggestion.displayName} (${secondary})`;
};

/** Empty allowed; non-empty must match API `z.string().email()`. */
const isOptionalEmailValid = (raw) => {
    const value = String(raw ?? "").trim();
    if (!value) {
        return true;
    }
    return z.string().email().safeParse(value).success;
};

/** Human-readable profile target for the inspector hint (falls back to id if fields are empty). */
const formatProfileSaveTargetSummary = (fullName, email, userId) => {
    const name = String(fullName ?? "").trim();
    const mail = String(email ?? "").trim();
    if (name && mail) {
        return `${name} · ${mail}`;
    }
    if (name) {
        return name;
    }
    if (mail) {
        return mail;
    }
    return `user ${userId}`;
};

/** `fetchUserDetail` → `{ user, fields }`; tolerate `profileFields` on root. */
const getUserProfileFieldsSource = (detail) => {
    if (!detail || typeof detail !== "object") {
        return null;
    }
    if (detail.user && Array.isArray(detail.user.profileFields)) {
        return detail.user;
    }
    if (Array.isArray(detail.profileFields)) {
        return detail;
    }
    return null;
};

const parseSavedActualPassword = (detail) => {
    const source = getUserProfileFieldsSource(detail);
    const fields = source?.profileFields;
    if (!Array.isArray(fields)) {
        return "";
    }
    const field = fields.find(
        (f) => f.key === "actual-password" || f.fieldKey === "actual-password"
    );
    const raw = field?.value;
    if (raw == null) {
        return "";
    }
    return String(raw).trim();
};

const ActualPasswordPanel = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [selectedUserId, setSelectedUserId] = useState("");
    const [resolverSuggestions, setResolverSuggestions] = useState([]);
    const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
    /** After a directory pick, keep the list hidden until the user edits name or email (survives focus/undismiss races). */
    const [hideSuggestionsUntilFieldEdit, setHideSuggestionsUntilFieldEdit] = useState(false);
    const identityRowRef = useRef(null);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [dob, setDob] = useState("");
    const [temporaryPassword, setTemporaryPassword] = useState("");
    const [length, setLength] = useState(12);
    const [charset, setCharset] = useState(defaultCharset);
    const [previewResult, setPreviewResult] = useState(null);
    const previewMutation = useActualPasswordPreview();
    const mutateRef = useRef(previewMutation.mutate);

    useEffect(() => {
        mutateRef.current = previewMutation.mutate;
    }, [previewMutation.mutate]);

    const searchQuery = useMemo(() => buildUserSearchQuery(fullName, email), [fullName, email]);

    useEffect(() => {
        let cancelled = false;
        const q = searchQuery;

        if (!q) {
            setResolverSuggestions([]);
            return () => {
                cancelled = true;
            };
        }

        const timer = window.setTimeout(async () => {
            const result = await fetchUsers({ search: q });
            if (cancelled) {
                return;
            }

            setResolverSuggestions(
                (result.users || []).map((user) => ({
                    id: user.id,
                    username: user.username,
                    displayName: user.ldapFields?.cn || user.username,
                    mail: coerceMailString(user.ldapFields?.mail)
                }))
            );
        }, 200);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [searchQuery]);

    useEffect(() => {
        const dismissIfOutside = (event) => {
            const node = identityRowRef.current;
            if (node && !node.contains(event.target)) {
                setSuggestionsDismissed(true);
            }
        };
        document.addEventListener("mousedown", dismissIfOutside);
        document.addEventListener("touchstart", dismissIfOutside, { passive: true });
        return () => {
            document.removeEventListener("mousedown", dismissIfOutside);
            document.removeEventListener("touchstart", dismissIfOutside);
        };
    }, []);

    const enabledCount = useMemo(
        () => [charset.uppercase, charset.lowercase, charset.digit, charset.special].filter(Boolean).length,
        [charset]
    );

    const emailFormatOk = useMemo(() => isOptionalEmailValid(email), [email]);

    const canPreview = enabledCount > 0 && length >= enabledCount && emailFormatOk;

    const payload = useMemo(
        () => ({
            fullName,
            email,
            dob,
            temporaryPassword,
            length,
            charset
        }),
        [fullName, email, dob, temporaryPassword, length, charset]
    );

    useEffect(() => {
        if (!canPreview) {
            setPreviewResult(null);
            return;
        }

        const timer = window.setTimeout(() => {
            mutateRef.current(payload, {
                onSuccess: (data) => {
                    setPreviewResult(data);
                },
                onError: () => {
                    setPreviewResult(null);
                }
            });
        }, 200);

        return () => {
            window.clearTimeout(timer);
        };
    }, [payload, canPreview]);

    const selectedUserQuery = useQuery({
        queryKey: ["users", selectedUserId],
        queryFn: () => fetchUserDetail(selectedUserId),
        enabled: Boolean(selectedUserId)
    });

    const currentActualPassword = useMemo(
        () => parseSavedActualPassword(selectedUserQuery.data),
        [selectedUserQuery.data]
    );

    const saveMutation = useMutation({
        mutationFn: async ({ userId, password }) => {
            await updateUserProfileFields(userId, {
                "actual-password": password
            });
        },
        onSuccess: async (_data, { userId }) => {
            await queryClient.invalidateQueries({ queryKey: ["users", userId] });
        }
    });

    const toggleCharset = (key) => {
        setCharset((current) => ({
            ...current,
            [key]: !current[key]
        }));
    };

    const handleSelectSuggestion = (suggestion) => {
        saveMutation.reset();
        setHideSuggestionsUntilFieldEdit(true);
        setSelectedUserId(suggestion.id);
        setFullName(suggestion.displayName || suggestion.username || "");
        setEmail(suggestion.mail || suggestion.username || "");
        setResolverSuggestions([]);
        setSuggestionsDismissed(true);
    };

    const clearSelection = () => {
        setSelectedUserId("");
    };

    const hasSuggestions =
        resolverSuggestions.length > 0 && !suggestionsDismissed && !hideSuggestionsUntilFieldEdit;
    const profileReadyForSave = !selectedUserId || selectedUserQuery.isSuccess;
    const canSaveToProfile = Boolean(selectedUserId && previewResult?.password && profileReadyForSave);

    const profileSaveTargetSummary = useMemo(
        () => formatProfileSaveTargetSummary(fullName, email, selectedUserId),
        [fullName, email, selectedUserId]
    );

    return (
        <div className="imap-generator-shell actual-password-shell">
            <div className="imap-generator-workbench actual-password-workbench">
                <section className="imap-generator-panel">
                    <h2>Yahoo actual password</h2>

                    <div className="actual-password-identity-row" ref={identityRowRef}>
                        <div className="actual-password-form-grid actual-password-identity-fields">
                            <label className="actual-password-field" htmlFor="actual-password-full-name">
                                <span>Full name</span>
                                <input
                                    aria-autocomplete="list"
                                    aria-controls={hasSuggestions ? "actual-password-user-suggestions" : undefined}
                                    aria-expanded={hasSuggestions ? "true" : "false"}
                                    autoComplete="name"
                                    className="imap-generator-input"
                                    id="actual-password-full-name"
                                    onChange={(event) => {
                                        setHideSuggestionsUntilFieldEdit(false);
                                        setFullName(event.target.value);
                                        setSuggestionsDismissed(false);
                                        clearSelection();
                                    }}
                                    onFocus={() => {
                                        setSuggestionsDismissed(false);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Escape" && resolverSuggestions.length > 0) {
                                            setSuggestionsDismissed(true);
                                        }
                                    }}
                                    type="text"
                                    value={fullName}
                                />
                            </label>
                            <label className="actual-password-field" htmlFor="actual-password-email">
                                <span>Email</span>
                                <input
                                    aria-autocomplete="list"
                                    aria-controls={hasSuggestions ? "actual-password-user-suggestions" : undefined}
                                    aria-expanded={hasSuggestions ? "true" : "false"}
                                    aria-invalid={email.trim() && !emailFormatOk ? "true" : undefined}
                                    autoComplete="email"
                                    className="imap-generator-input"
                                    id="actual-password-email"
                                    inputMode="email"
                                    onChange={(event) => {
                                        setHideSuggestionsUntilFieldEdit(false);
                                        setEmail(event.target.value);
                                        setSuggestionsDismissed(false);
                                        clearSelection();
                                    }}
                                    onFocus={() => {
                                        setSuggestionsDismissed(false);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Escape" && resolverSuggestions.length > 0) {
                                            setSuggestionsDismissed(true);
                                        }
                                    }}
                                    type="email"
                                    title="Valid email address when filled"
                                    value={email}
                                />
                                {email.trim() && !emailFormatOk ? (
                                    <span className="actual-password-field-error" role="alert">
                                        Enter a valid email address.
                                    </span>
                                ) : null}
                            </label>
                        </div>
                        {hasSuggestions ? (
                            <div
                                aria-label="User search suggestions"
                                className="imap-generator-suggestions actual-password-suggestions"
                                id="actual-password-user-suggestions"
                                role="listbox"
                            >
                                {resolverSuggestions.map((suggestion) => (
                                    <button
                                        className="imap-generator-suggestion"
                                        key={suggestion.id}
                                        onClick={() => handleSelectSuggestion(suggestion)}
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                        }}
                                        type="button"
                                    >
                                        {suggestionButtonLabel(suggestion)}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <div className="actual-password-form-grid">
                        <label className="actual-password-field" htmlFor="actual-password-dob">
                            <span>Date of birth</span>
                            <IsoDatePopoverField id="actual-password-dob" onChange={setDob} value={dob} />
                        </label>
                        <label className="actual-password-field">
                            <span>Yahoo temporary password</span>
                            <input
                                autoComplete="off"
                                className="imap-generator-input"
                                onChange={(event) => setTemporaryPassword(event.target.value)}
                                type="password"
                                value={temporaryPassword}
                            />
                        </label>
                    </div>

                    <div className="actual-password-options">
                        <label className="actual-password-slider-label">
                            <span>Password length ({length})</span>
                            <input
                                max={24}
                                min={8}
                                onChange={(event) => setLength(Number(event.target.value))}
                                type="range"
                                value={length}
                            />
                        </label>
                        <fieldset className="actual-password-charset">
                            <legend>Character classes</legend>
                            <label className="imap-generator-toggle">
                                <input
                                    checked={charset.uppercase}
                                    onChange={() => toggleCharset("uppercase")}
                                    type="checkbox"
                                />
                                <span>Uppercase</span>
                            </label>
                            <label className="imap-generator-toggle">
                                <input
                                    checked={charset.lowercase}
                                    onChange={() => toggleCharset("lowercase")}
                                    type="checkbox"
                                />
                                <span>Lowercase</span>
                            </label>
                            <label className="imap-generator-toggle">
                                <input
                                    checked={charset.digit}
                                    onChange={() => toggleCharset("digit")}
                                    type="checkbox"
                                />
                                <span>Numbers</span>
                            </label>
                            <label className="imap-generator-toggle">
                                <input
                                    checked={charset.special}
                                    onChange={() => toggleCharset("special")}
                                    type="checkbox"
                                />
                                <span>Special</span>
                            </label>
                        </fieldset>
                        {!canPreview && enabledCount > 0 ? (
                            <p className="actual-password-hint" role="status">
                                Length must be at least {enabledCount} to include each selected character class.
                            </p>
                        ) : null}
                        {enabledCount === 0 ? (
                            <p className="actual-password-hint" role="status">
                                Select at least one character class.
                            </p>
                        ) : null}
                    </div>
                </section>
            </div>

            <aside className="imap-generator-panel imap-generator-inspector">
                <h2>Live preview</h2>
                {selectedUserId ? (
                    <div className="imap-generator-preview-row">
                        <span className="imap-generator-preview-label">Current saved password</span>
                        {selectedUserQuery.isPending ? (
                            <span className="imap-generator-preview-empty">Loading profile…</span>
                        ) : selectedUserQuery.isError ? (
                            <span className="imap-generator-preview-empty" role="alert">
                                Could not load profile
                            </span>
                        ) : currentActualPassword ? (
                            <code className="imap-generator-password">{currentActualPassword}</code>
                        ) : (
                            <span className="imap-generator-preview-empty">None saved yet</span>
                        )}
                    </div>
                ) : null}
                <div className="imap-generator-preview-row">
                    <span className="imap-generator-preview-label">
                        {selectedUserId ? "New password (preview)" : "Password"}
                    </span>
                    {previewResult?.password ? (
                        <code className="imap-generator-password">{previewResult.password}</code>
                    ) : (
                        <span className="imap-generator-preview-empty">
                            {canPreview
                                ? "Preview loading…"
                                : email.trim() && !emailFormatOk
                                  ? "Enter a valid email to preview"
                                  : "Adjust options to preview"}
                        </span>
                    )}
                </div>
                {selectedUserId ? (
                    <p className="actual-password-hint" role="status">
                        Profile save target: {profileSaveTargetSummary}
                    </p>
                ) : null}
                <div className="actual-password-save-row">
                    <button
                        className="workspace-inline-button"
                        disabled={!canSaveToProfile || saveMutation.isPending}
                        onClick={() => {
                            const password = previewResult?.password;
                            if (!selectedUserId || !password) {
                                return;
                            }
                            const detail =
                                queryClient.getQueryData(["users", selectedUserId]) ??
                                selectedUserQuery.data;
                            const existingSaved = parseSavedActualPassword(detail);
                            if (existingSaved) {
                                const ok = window.confirm(
                                    `Replace the saved actual password for ${profileSaveTargetSummary}? The previous value will be overwritten.`
                                );
                                if (!ok) {
                                    return;
                                }
                            }
                            saveMutation.mutate({
                                userId: selectedUserId,
                                password
                            });
                        }}
                        type="button"
                    >
                        {saveMutation.isPending ? "Saving…" : "Save password to profile"}
                    </button>
                    {saveMutation.isSuccess ? (
                        <button
                            className="workspace-inline-button"
                            onClick={() => navigate(`/users/${saveMutation.variables?.userId}`)}
                            type="button"
                        >
                            Open user profile
                        </button>
                    ) : null}
                </div>
                {saveMutation.isSuccess ? (
                    <p className="actual-password-hint" role="status">
                        Saved to user profile.
                    </p>
                ) : null}
                {saveMutation.isError ? (
                    <p className="credentials-error" role="alert">
                        {saveMutation.error?.message || "Save failed"}
                    </p>
                ) : null}
                {previewMutation.isPending && canPreview ? (
                    <p className="actual-password-hint">Updating…</p>
                ) : null}
                {previewMutation.isError ? (
                    <p className="credentials-error" role="alert">
                        {previewMutation.error?.message || "Preview failed"}
                    </p>
                ) : null}
            </aside>
        </div>
    );
};

export default ActualPasswordPanel;
