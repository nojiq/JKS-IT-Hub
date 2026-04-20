import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchUsers } from "../../users/users-api.js";
import ImapFieldWorkbench from "./ImapFieldWorkbench.jsx";
import ImapPreviewInspector from "./ImapPreviewInspector.jsx";
import PreviousImapPasswordsModal from "./PreviousImapPasswordsModal.jsx";
import ImapSyncConflictPanel from "./ImapSyncConflictPanel.jsx";
import ImapUserResolver from "./ImapUserResolver.jsx";
import { useImapConflictReview, useImapPreview, useImapSave, useImapWorkbench, usePreviousImapPasswords } from "../hooks/useImapGenerator.js";
import "./ImapGeneratorPage.css";

const createEmptyFields = () => ({
    email: { value: "", source: "empty" },
    firstName: { value: "", source: "empty" },
    lastName: { value: "", source: "empty" },
    fullName: { value: "", source: "empty" },
    dob: { value: "", source: "empty" },
    phone: { value: "", source: "empty" }
});

const ImapGeneratorPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialUserId = searchParams.get("userId") || "";
    const [selectedUserId, setSelectedUserId] = useState(initialUserId);
    const [mode, setMode] = useState(initialUserId ? "attached" : "attached");
    const [manualIdentity, setManualIdentity] = useState({
        fullName: "",
        email: ""
    });
    const [isPreviousPasswordsOpen, setIsPreviousPasswordsOpen] = useState(false);
    const [resolverQuery, setResolverQuery] = useState("");
    const [resolverSuggestions, setResolverSuggestions] = useState([]);
    const [fields, setFields] = useState(createEmptyFields);
    const [selectedFields, setSelectedFields] = useState({
        email: false,
        firstName: false,
        lastName: false,
        fullName: false,
        dob: false,
        phone: false
    });
    const workbenchQuery = useImapWorkbench(selectedUserId);
    const previewMutation = useImapPreview();
    const saveMutation = useImapSave();
    const conflictReviewMutation = useImapConflictReview();
    const previousPasswordsQuery = usePreviousImapPasswords(
        isPreviousPasswordsOpen && selectedUserId ? selectedUserId : null
    );

    useEffect(() => {
        setSelectedUserId(initialUserId);
    }, [initialUserId]);

    const handleManualIdentityChange = (field, value) => {
        setManualIdentity((current) => ({
            ...current,
            [field]: value
        }));
    };

    useEffect(() => {
        if (!workbenchQuery.data?.fields || mode !== "attached") {
            return;
        }

        setFields((current) => ({
            ...current,
            ...workbenchQuery.data.fields
        }));
    }, [mode, workbenchQuery.data]);

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

    const handleFieldChange = (field, value) => {
        setFields((current) => ({
            ...current,
            [field]: {
                ...current[field],
                value,
                source: value.trim() ? "system" : (current[field]?.ldapValue ? "ldap" : "empty")
            }
        }));
    };

    const handleToggleField = (field, checked) => {
        setSelectedFields((current) => ({
            ...current,
            [field]: checked
        }));
    };

    const saveDisabled = useMemo(() => {
        if (mode !== "manual") {
            return false;
        }

        return !manualIdentity.fullName.trim() || !manualIdentity.email.trim();
    }, [manualIdentity.email, manualIdentity.fullName, mode]);

    const previewPayload = useMemo(() => ({
        userId: mode === "attached" && selectedUserId ? selectedUserId : undefined,
        manualIdentity: mode === "manual" ? manualIdentity : undefined,
        username: fields.email?.value || manualIdentity.email || undefined,
        inputs: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.value])),
        selectedFields
    }), [fields, manualIdentity, mode, selectedUserId, selectedFields]);

    useEffect(() => {
        const hasSelectedFields = Object.values(selectedFields).some(Boolean);
        const hasValidManualIdentity = mode !== "manual" || (manualIdentity.fullName.trim() && manualIdentity.email.trim());
        const hasAttachedUser = mode !== "attached" || Boolean(selectedUserId);

        if (!hasSelectedFields || !hasValidManualIdentity || !hasAttachedUser) {
            return;
        }

        previewMutation.mutate(previewPayload);
    }, [manualIdentity.email, manualIdentity.fullName, mode, previewMutation, previewPayload, selectedUserId, selectedFields]);

    const handleSave = () => {
        saveMutation.mutate(previewPayload);
    };

    const handleSelectSuggestion = (suggestion) => {
        setMode("attached");
        setSelectedUserId(suggestion.id);
        setResolverQuery("");
        setResolverSuggestions([]);
        const params = new URLSearchParams(searchParams);
        params.set("userId", suggestion.id);
        setSearchParams(params);
    };

    const handleUseLdap = (field) => {
        if (!selectedUserId) {
            return;
        }

        conflictReviewMutation.mutate({
            userId: selectedUserId,
            payload: {
                fields: {
                    [field]: "use_ldap"
                }
            }
        });
    };

    return (
        <section className="workspace-page users-page imap-generator-page">
            <header className="imap-generator-header">
                <h1>IMAP Generator</h1>
                <p>Resolve a user, edit the IMAP profile fields, and preview deterministic passwords before saving.</p>
            </header>

            <div className="imap-generator-shell">
                <div className="imap-generator-workbench">
                    <ImapUserResolver
                        attachedUserId={selectedUserId}
                        manualIdentity={manualIdentity}
                        mode={mode}
                        onManualIdentityChange={handleManualIdentityChange}
                        onModeChange={setMode}
                        onResolverChange={setResolverQuery}
                        onSelectSuggestion={handleSelectSuggestion}
                        resolverQuery={resolverQuery}
                        suggestions={resolverSuggestions}
                    />
                    <ImapSyncConflictPanel
                        conflicts={workbenchQuery.data?.conflicts || []}
                        onUseLdap={handleUseLdap}
                    />
                    <ImapFieldWorkbench
                        fields={fields}
                        onFieldChange={handleFieldChange}
                        onToggleField={handleToggleField}
                        selectedFields={selectedFields}
                    />
                </div>

                <ImapPreviewInspector
                    onOpenPreviousPasswords={() => setIsPreviousPasswordsOpen(true)}
                    onSave={handleSave}
                    passwordPreview={previewMutation.data?.proposedCredential?.password || "••••••••••••••••"}
                    saveDisabled={saveDisabled}
                />
            </div>
            <PreviousImapPasswordsModal
                entries={previousPasswordsQuery.data || []}
                isOpen={isPreviousPasswordsOpen}
                onClose={() => setIsPreviousPasswordsOpen(false)}
            />
        </section>
    );
};

export default ImapGeneratorPage;
