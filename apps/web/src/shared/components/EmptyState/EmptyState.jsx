
import './EmptyState.css';

export const EmptyState = ({
    title = "No data found",
    description,
    icon,
    action,
    className = ""
}) => {
    return (
        <div className={`empty-state-container ${className}`}>
            {icon && <div className="empty-state-icon">{icon}</div>}

            <h3 className="empty-state-title">{title}</h3>

            {description && (
                <p className="empty-state-description">{description}</p>
            )}

            {action && (
                <div className="empty-state-action-container">
                    {action}
                </div>
            )}
        </div>
    );
};
