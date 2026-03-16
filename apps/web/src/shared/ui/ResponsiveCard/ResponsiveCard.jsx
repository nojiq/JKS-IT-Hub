import { useIsMobile } from '../../hooks';
import './ResponsiveCard.css';

/**
 * Responsive card component that adapts between mobile card and desktop table row
 * 
 * @param {Object} props
 * @param {Object} props.data - Data object to display
 * @param {Array} props.columns - Column configuration [{key, label, render}]
 * @param {React.ReactNode} [props.actions] - Action buttons/elements
 * @param {Function} [props.onClick] - Optional click handler for the card
 * @param {string} [props.className] - Additional CSS classes
 */
export function ResponsiveCard({
    data,
    columns,
    actions,
    onClick,
    className = ''
}) {
    const isMobile = useIsMobile();

    if (!isMobile) {
        // Desktop: render as table row (parent should be a table)
        return null; // Parent component handles table rendering
    }

    // Mobile: render as card
    return (
        <div
            className={`responsive-card ${onClick ? 'clickable' : ''} ${className}`}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            } : undefined}
        >
            <div className="responsive-card-content">
                {columns.map((column) => (
                    <div key={column.key} className="responsive-card-field">
                        <div className="responsive-card-label">{column.label}</div>
                        <div className="responsive-card-value">
                            {column.render ? column.render(data[column.key], data) : data[column.key]}
                        </div>
                    </div>
                ))}
            </div>

            {actions && (
                <div className="responsive-card-actions">
                    {actions}
                </div>
            )}
        </div>
    );
}
