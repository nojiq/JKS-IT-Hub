const FIELD_ROWS = [
    "Email",
    "First Name",
    "Last Name",
    "Full Name",
    "DOB",
    "Phone"
];

const ImapFieldWorkbench = () => {
    return (
        <section className="imap-generator-panel">
            <h2>Field Workbench</h2>
            <div className="imap-generator-field-grid" role="table" aria-label="IMAP field workbench">
                {FIELD_ROWS.map((field) => (
                    <div className="imap-generator-field-row" key={field} role="row">
                        <label className="imap-generator-toggle">
                            <input type="checkbox" />
                            <span>Use</span>
                        </label>
                        <span className="imap-generator-field-name">{field}</span>
                        <input
                            className="imap-generator-input"
                            type="text"
                            aria-label={field}
                            placeholder={`Enter ${field}`}
                        />
                        <span className="imap-generator-badge">EMPTY</span>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ImapFieldWorkbench;
