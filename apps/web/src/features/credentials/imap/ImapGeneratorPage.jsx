import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ImapFieldWorkbench from "./ImapFieldWorkbench.jsx";
import ImapPreviewInspector from "./ImapPreviewInspector.jsx";
import ImapUserResolver from "./ImapUserResolver.jsx";
import { useImapPreview, useImapSave, useImapWorkbench } from "../hooks/useImapGenerator.js";
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
    const [searchParams] = useSearchParams();
    const attachedUserId = searchParams.get("userId") || "";
    const [mode, setMode] = useState(attachedUserId ? "attached" : "attached");
    const [manualIdentity, setManualIdentity] = useState({
        fullName: "",
        email: ""
    });
    const [fields, setFields] = useState(createEmptyFields);
    const [selectedFields, setSelectedFields] = useState({
        email: false,
        firstName: false,
        lastName: false,
        fullName: false,
        dob: false,
        phone: false
    });
    const workbenchQuery = useImapWorkbench(attachedUserId);
    const previewMutation = useImapPreview();
    const saveMutation = useImapSave();

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
        userId: mode === "attached" && attachedUserId ? attachedUserId : undefined,
        manualIdentity: mode === "manual" ? manualIdentity : undefined,
        username: fields.email?.value || manualIdentity.email || undefined,
        inputs: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.value])),
        selectedFields
    }), [attachedUserId, fields, manualIdentity, mode, selectedFields]);

    useEffect(() => {
        const hasSelectedFields = Object.values(selectedFields).some(Boolean);
        const hasValidManualIdentity = mode !== "manual" || (manualIdentity.fullName.trim() && manualIdentity.email.trim());
        const hasAttachedUser = mode !== "attached" || Boolean(attachedUserId);

        if (!hasSelectedFields || !hasValidManualIdentity || !hasAttachedUser) {
            return;
        }

        previewMutation.mutate(previewPayload);
    }, [attachedUserId, manualIdentity.email, manualIdentity.fullName, mode, previewMutation, previewPayload, selectedFields]);

    const handleSave = () => {
        saveMutation.mutate(previewPayload);
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
                        attachedUserId={attachedUserId}
                        manualIdentity={manualIdentity}
                        mode={mode}
                        onManualIdentityChange={handleManualIdentityChange}
                        onModeChange={setMode}
                    />
                    <ImapFieldWorkbench
                        fields={fields}
                        onFieldChange={handleFieldChange}
                        onToggleField={handleToggleField}
                        selectedFields={selectedFields}
                    />
                </div>

                <ImapPreviewInspector
                    onSave={handleSave}
                    passwordPreview={previewMutation.data?.proposedCredential?.password || "••••••••••••••••"}
                    saveDisabled={saveDisabled}
                />
            </div>
        </section>
    );
};

export default ImapGeneratorPage;
