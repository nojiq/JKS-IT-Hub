const ImapPreviewInspector = ({
    passwordPreview = null,
    saveDisabled = false,
    onOpenPreviousPasswords,
    onSave,
    selectedFieldsText = "None",
    usernamePreview = "—"
}) => {
    return (
        <aside className="imap-generator-panel imap-generator-inspector">
            <h2>Live Preview</h2>
            <div className="imap-generator-preview-row">
                <span className="imap-generator-preview-label">Username</span>
                <strong>{usernamePreview}</strong>
            </div>
            <div className="imap-generator-preview-row">
                <span className="imap-generator-preview-label">Password</span>
                {passwordPreview ? (
                    <code className="imap-generator-password">{passwordPreview}</code>
                ) : (
                    <span className="imap-generator-preview-empty">Select fields to generate</span>
                )}
            </div>
            <div className="imap-generator-preview-row">
                <span className="imap-generator-preview-label">Selected Fields</span>
                <span>{selectedFieldsText}</span>
            </div>
            <label className="imap-generator-toggle imap-generator-active-toggle">
                <input type="checkbox" />
                <span>Set as active</span>
            </label>
            <div className="imap-generator-action-stack">
                <button className="workspace-inline-button" disabled={saveDisabled} onClick={onSave} type="button">Save IMAP Password</button>
                <button className="workspace-inline-link" onClick={onOpenPreviousPasswords} type="button">Previous IMAP Passwords</button>
            </div>
        </aside>
    );
};

export default ImapPreviewInspector;
