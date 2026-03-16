
const STATUS_CONFIG = {
    SUBMITTED: { label: 'Submitted', className: 'badge-submitted', color: '#eff6ff', textColor: '#1e40af', borderColor: '#bfdbfe' }, // blue-50, blue-800, blue-200
    IT_REVIEWED: { label: 'IT Reviewed', className: 'badge-reviewed', color: '#fffbeb', textColor: '#92400e', borderColor: '#fde68a' }, // amber-50, amber-800, amber-200
    APPROVED: { label: 'Approved', className: 'badge-approved', color: '#ecfdf5', textColor: '#065f46', borderColor: '#a7f3d0' }, // emerald-50, emerald-800, emerald-200
    REJECTED: { label: 'Rejected', className: 'badge-rejected', color: '#fef2f2', textColor: '#991b1b', borderColor: '#fecaca' }, // red-50, red-800, red-200
    ALREADY_PURCHASED: { label: 'Already Purchased', className: 'badge-purchased', color: '#f3f4f6', textColor: '#1f2937', borderColor: '#e5e7eb' } // gray-50, gray-800, gray-200
};

const RequestStatusBadge = ({ status }) => {
    const config = STATUS_CONFIG[status] || { label: status, className: 'badge-default', color: '#f3f4f6', textColor: '#374151', borderColor: '#d1d5db' };

    return (
        <span
            className={`status-badge ${config.className}`}
            style={{
                backgroundColor: config.color,
                color: config.textColor,
                border: `1px solid ${config.borderColor}`,
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'inline-block'
            }}
        >
            {config.label}
        </span>
    );
};

export default RequestStatusBadge;
