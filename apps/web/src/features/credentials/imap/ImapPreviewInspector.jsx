const ImapPreviewInspector = () => {
    return (
        <aside className="imap-generator-panel imap-generator-inspector">
            <h2>Live Preview</h2>
            <div className="imap-generator-preview-row">
                <span className="imap-generator-preview-label">Username</span>
                <strong>—</strong>
            </div>
            <div className="imap-generator-preview-row">
                <span className="imap-generator-preview-label">Password</span>
                <code className="imap-generator-password">••••••••••••••••</code>
            </div>
            <div className="imap-generator-preview-row">
                <span className="imap-generator-preview-label">Selected Fields</span>
                <span>None</span>
            </div>
            <label className="imap-generator-toggle imap-generator-active-toggle">
                <input type="checkbox" />
                <span>Set as active</span>
            </label>
            <div className="imap-generator-action-stack">
                <button className="workspace-inline-button" type="button">Save IMAP Password</button>
                <button className="workspace-inline-link" type="button">Previous IMAP Passwords</button>
            </div>
        </aside>
    );
};

export default ImapPreviewInspector;
