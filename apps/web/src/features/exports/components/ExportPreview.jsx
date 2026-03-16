export function ExportPreview({ credentials = [] }) {
    const excludedCount = credentials.filter((credential) => credential?.systemConfig?.isItOnly).length;
    const exportableCount = Math.max(credentials.length - excludedCount, 0);

    return (
        <div className="export-preview" role="note">
            <p className="export-preview-message">
                IMAP credentials are excluded from exports for security.
            </p>
            <p className="export-preview-count">
                {excludedCount > 0
                    ? `${excludedCount} IT-only credential(s) excluded. ${exportableCount} credential(s) will be exported.`
                    : "No IT-only credentials detected for this user."}
            </p>
        </div>
    );
}

