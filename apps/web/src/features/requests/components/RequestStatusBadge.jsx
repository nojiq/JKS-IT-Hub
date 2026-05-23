const LEGACY_STATUS_CONFIG = {
    SUBMITTED: { label: "Submitted", color: "#eff6ff", textColor: "#1e40af", borderColor: "#bfdbfe" },
    IT_REVIEWED: { label: "IT Reviewed", color: "#fffbeb", textColor: "#92400e", borderColor: "#fde68a" },
    APPROVED: { label: "Approved", color: "#ecfdf5", textColor: "#065f46", borderColor: "#a7f3d0" },
    REJECTED: { label: "Rejected", color: "#fef2f2", textColor: "#991b1b", borderColor: "#fecaca" },
    ALREADY_PURCHASED: { label: "Already Purchased", color: "#f3f4f6", textColor: "#1f2937", borderColor: "#e5e7eb" }
};

const RECORD_STATUS_CONFIG = {
    RECORDED: { label: "Recorded", color: "#eff6ff", textColor: "#1e40af", borderColor: "#bfdbfe" },
    REJECTED: { label: "Rejected", color: "#fef2f2", textColor: "#991b1b", borderColor: "#fecaca" },
    ARCHIVED: { label: "Archived", color: "#f3f4f6", textColor: "#374151", borderColor: "#e5e7eb" }
};

const APPROVAL_STATUS_CONFIG = {
    NOT_REQUIRED: { label: "No approval", color: "#f8fafc", textColor: "#475569", borderColor: "#e2e8f0" },
    PENDING: { label: "Pending approval", color: "#fffbeb", textColor: "#92400e", borderColor: "#fde68a" },
    APPROVED: { label: "Approved", color: "#ecfdf5", textColor: "#065f46", borderColor: "#a7f3d0" },
    SKIPPED: { label: "Skipped", color: "#f3f4f6", textColor: "#1f2937", borderColor: "#e5e7eb" },
    REJECTED: { label: "Rejected", color: "#fef2f2", textColor: "#991b1b", borderColor: "#fecaca" }
};

const resolveConfig = ({ status, recordStatus, approvalStatus }) => {
    if (recordStatus || approvalStatus) {
        if (recordStatus === "REJECTED" || approvalStatus === "REJECTED") {
            return RECORD_STATUS_CONFIG.REJECTED;
        }
        if (approvalStatus && approvalStatus !== "NOT_REQUIRED") {
            return APPROVAL_STATUS_CONFIG[approvalStatus] ?? APPROVAL_STATUS_CONFIG.NOT_REQUIRED;
        }
        return RECORD_STATUS_CONFIG[recordStatus] ?? RECORD_STATUS_CONFIG.RECORDED;
    }

    return LEGACY_STATUS_CONFIG[status] ?? {
        label: status,
        color: "#f3f4f6",
        textColor: "#374151",
        borderColor: "#d1d5db"
    };
};

const RequestStatusBadge = ({ status, recordStatus, approvalStatus, className = "" }) => {
    const config = resolveConfig({ status, recordStatus, approvalStatus });

    return (
        <span
            className={`status-badge ${className}`.trim()}
            style={{
                backgroundColor: config.color,
                color: config.textColor,
                border: `1px solid ${config.borderColor}`,
                padding: "0.25rem 0.75rem",
                borderRadius: "9999px",
                fontSize: "0.75rem",
                fontWeight: "600",
                letterSpacing: "0.04em",
                display: "inline-block",
                whiteSpace: "nowrap"
            }}
        >
            {config.label}
        </span>
    );
};

export default RequestStatusBadge;
