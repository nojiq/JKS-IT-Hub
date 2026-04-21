const FIELD_ROWS = [
    { key: "email", label: "Email" },
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "fullName", label: "Full Name" },
    { key: "dob", label: "DOB" },
    { key: "phone", label: "Phone" }
];

const formatBadge = (source) => {
    if (!source) return "EMPTY";
    return String(source).toUpperCase();
};

const ImapFieldWorkbench = ({ fields, onFieldChange, selectedFields, onToggleField }) => {
    return (
        <section className="imap-generator-panel">
            <h2>Field Workbench</h2>
            <div className="imap-generator-field-grid" role="table" aria-label="IMAP field workbench">
                {FIELD_ROWS.map((field) => (
                    <div className="imap-generator-field-row" key={field.key} role="row">
                        <label className="imap-generator-toggle">
                            <input
                                aria-label={`Use ${field.label}`}
                                checked={Boolean(selectedFields[field.key])}
                                onChange={(event) => onToggleField(field.key, event.target.checked)}
                                type="checkbox"
                            />
                        </label>
                        <span className="imap-generator-field-name">{field.label}</span>
                        <input
                            className="imap-generator-input"
                            type="text"
                            aria-label={field.label}
                            placeholder={`Enter ${field.label}`}
                            value={fields[field.key]?.value || ""}
                            onChange={(event) => onFieldChange(field.key, event.target.value)}
                        />
                        <span className="imap-generator-badge">{formatBadge(fields[field.key]?.source)}</span>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ImapFieldWorkbench;
