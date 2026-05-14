import { useEffect, useState } from "react";
import { fetchUsers } from "../../users/users-api.js";
import PreviousImapPasswordsModal from "../imap/PreviousImapPasswordsModal.jsx";
import { useImapSave, useImapWorkbench, usePreviousImapPasswords } from "../hooks/useImapGenerator.js";

const ProviderImapPanel = ({ initialUserId = "" }) => {
    const [selectedUserId, setSelectedUserId] = useState(initialUserId);
    const [selectedLabel, setSelectedLabel] = useState("");
    const [resolverQuery, setResolverQuery] = useState("");
    const [resolverSuggestions, setResolverSuggestions] = useState([]);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [setActive, setSetActive] = useState(true);
    const [isPreviousOpen, setIsPreviousOpen] = useState(false);
    const [formError, setFormError] = useState("");

    const workbenchQuery = useImapWorkbench(selectedUserId);
    const saveMutation = useImapSave();
    const previousPasswordsQuery = usePreviousImapPasswords(
        isPreviousOpen && selectedUserId ? selectedUserId : null
    );

    useEffect(() => {
        setSelectedUserId(initialUserId);
    }, [initialUserId]);

    useEffect(() => {
        let cancelled = false;

        if (!resolverQuery.trim()) {
            setResolverSuggestions([]);
            return () => {
                cancelled = true;
            };
        }

        const loadSuggestions = async () => {
            const result = await fetchUsers({ search: resolverQuery.trim() });
            if (cancelled) {
                return;
            }

            setResolverSuggestions(
                (result.users || []).map((user) => ({
                    id: user.id,
                    username: user.username,
                    displayName: user.ldapFields?.cn || user.username
                }))
            );
        };

        loadSuggestions();

        return () => {
            cancelled = true;
        };
    }, [resolverQuery]);

    useEffect(() => {
        if (!workbenchQuery.data?.user) {
            return;
        }
        setSelectedLabel(
            workbenchQuery.data.activeCredential?.username
                || workbenchQuery.data.user.username
                || workbenchQuery.data.user.id
        );
    }, [workbenchQuery.data]);

    useEffect(() => {
        if (!selectedUserId) {
            setUsername("");
            return;
        }
        const fromCredential = String(workbenchQuery.data?.activeCredential?.username ?? "").trim();
        setUsername(fromCredential);
    }, [selectedUserId, workbenchQuery.data?.activeCredential?.username]);

    useEffect(() => {
        setPassword("");
        setFormError("");
    }, [selectedUserId]);

    const handleSelectSuggestion = (suggestion) => {
        setSelectedUserId(suggestion.id);
        setSelectedLabel(suggestion.displayName || suggestion.username || suggestion.id);
        setResolverQuery("");
        setResolverSuggestions([]);
    };

    const handleSave = () => {
        setFormError("");
        if (!selectedUserId) {
            setFormError("Select a user from directory search.");
            return;
        }
        const trimmedPassword = password.trim();
        if (!trimmedPassword) {
            setFormError("Enter the IMAP password exactly as provided by the email provider.");
            return;
        }

        saveMutation.mutate(
            {
                userId: selectedUserId,
                username: username.trim() || undefined,
                password: trimmedPassword,
                setActive
            },
            {
                onSuccess: () => {
                    setPassword("");
                    workbenchQuery.refetch?.();
                },
                onError: (err) => {
                    setFormError(err.problemDetails?.detail || err.message || "Save failed");
                }
            }
        );
    };

    const handleRestorePassword = (credentialId, setActiveFlag) => {
        setFormError("");
        saveMutation.mutate(
            {
                userId: selectedUserId,
                restoreCredentialId: credentialId,
                setActive: setActiveFlag
            },
            {
                onSuccess: () => {
                    setIsPreviousOpen(false);
                    workbenchQuery.refetch?.();
                },
                onError: (err) => {
                    setFormError(err.problemDetails?.detail || err.message || "Restore failed");
                }
            }
        );
    };

    const hasSuggestions = resolverSuggestions.length > 0;

    return (
        <>
            <div className="imap-generator-shell">
                <div className="imap-generator-workbench">
                    <section className="imap-generator-panel">
                        <h2>Record provider IMAP password</h2>
                        <p className="imap-generator-helper">
                            IT does not generate IMAP passwords. Enter the password issued by the user&apos;s email
                            provider (for example the hosted mailbox or Yahoo app password).
                        </p>
                        <label className="imap-generator-label" htmlFor="provider-imap-user-search">
                            Search user
                        </label>
                        <div className="imap-generator-resolver">
                            <input
                                aria-autocomplete="list"
                                aria-controls={hasSuggestions ? "provider-imap-suggestions" : undefined}
                                aria-expanded={hasSuggestions ? "true" : "false"}
                                className="imap-generator-input"
                                id="provider-imap-user-search"
                                onChange={(event) => setResolverQuery(event.target.value)}
                                placeholder="Name or email"
                                type="search"
                                value={resolverQuery}
                            />
                            {hasSuggestions ? (
                                <div
                                    aria-label="User search suggestions"
                                    className="imap-generator-suggestions"
                                    id="provider-imap-suggestions"
                                    role="listbox"
                                >
                                    {resolverSuggestions.map((suggestion) => (
                                        <button
                                            className="imap-generator-suggestion"
                                            key={suggestion.id}
                                            onClick={() => handleSelectSuggestion(suggestion)}
                                            type="button"
                                        >
                                            {suggestion.displayName}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                        {selectedUserId ? (
                            <p className="imap-generator-helper">
                                Selected: {selectedLabel} ({selectedUserId})
                            </p>
                        ) : null}
                    </section>

                    <section className="imap-generator-panel">
                        <h2>IMAP login</h2>
                        <label className="imap-generator-label" htmlFor="provider-imap-username">
                            Username (usually full email)
                        </label>
                        <input
                            className="imap-generator-input"
                            disabled={!selectedUserId || workbenchQuery.isLoading}
                            id="provider-imap-username"
                            onChange={(event) => setUsername(event.target.value)}
                            placeholder="Defaults from current IMAP row or LDAP mail when left blank"
                            type="text"
                            value={username}
                        />
                        <label className="imap-generator-label" htmlFor="provider-imap-password">
                            Provider password *
                        </label>
                        <input
                            autoComplete="off"
                            className="imap-generator-input"
                            disabled={!selectedUserId}
                            id="provider-imap-password"
                            onChange={(event) => setPassword(event.target.value)}
                            type="password"
                            value={password}
                        />
                        <label className="imap-generator-toggle imap-generator-active-toggle">
                            <input
                                checked={setActive}
                                onChange={(event) => setSetActive(event.target.checked)}
                                type="checkbox"
                            />
                            <span>Save as active credential (uncheck to append history only)</span>
                        </label>
                        {formError ? (
                            <p className="imap-generator-helper" role="alert">
                                {formError}
                            </p>
                        ) : null}
                        <div className="imap-generator-action-stack">
                            <button
                                disabled={!selectedUserId || saveMutation.isPending}
                                onClick={handleSave}
                                type="button"
                            >
                                {saveMutation.isPending ? "Saving…" : "Save IMAP password"}
                            </button>
                            <button
                                disabled={!selectedUserId}
                                onClick={() => setIsPreviousOpen(true)}
                                type="button"
                            >
                                Previous passwords (
                                {workbenchQuery.data?.previousPasswordsCount ?? "—"})
                            </button>
                        </div>
                    </section>
                </div>
            </div>

            <PreviousImapPasswordsModal
                entries={previousPasswordsQuery.data || []}
                isOpen={isPreviousOpen}
                onClose={() => setIsPreviousOpen(false)}
                onRestore={handleRestorePassword}
            />
        </>
    );
};

export default ProviderImapPanel;
