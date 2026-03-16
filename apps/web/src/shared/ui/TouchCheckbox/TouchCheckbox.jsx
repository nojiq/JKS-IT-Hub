import './TouchCheckbox.css';

/**
 * Touch-friendly checkbox component with large touch targets
 * 
 * @param {Object} props
 * @param {boolean} props.checked - Whether the checkbox is checked
 * @param {Function} props.onChange - Callback when checkbox state changes
 * @param {string} props.label - Checkbox label text
 * @param {boolean} [props.required=false] - Whether the checkbox is required
 * @param {string} [props.description] - Optional description text
 * @param {boolean} [props.disabled=false] - Whether the checkbox is disabled
 * @param {string} [props.id] - Optional ID for the checkbox
 */
export function TouchCheckbox({
    checked,
    onChange,
    label,
    required = false,
    description,
    disabled = false,
    id
}) {
    const handleClick = () => {
        if (!disabled) {
            onChange(!checked);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            handleClick();
        }
    };

    return (
        <div
            className={`touch-checkbox ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            role="checkbox"
            aria-checked={checked}
            aria-disabled={disabled}
            aria-labelledby={id ? `${id}-label` : undefined}
            aria-describedby={description && id ? `${id}-description` : undefined}
            tabIndex={disabled ? -1 : 0}
        >
            <div className={`touch-checkbox-box ${checked ? 'checked' : ''}`}>
                {checked && (
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="touch-checkbox-checkmark"
                    >
                        <path
                            d="M13.3334 4L6.00002 11.3333L2.66669 8"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                )}
            </div>

            <div className="touch-checkbox-content">
                <div className="touch-checkbox-label" id={id ? `${id}-label` : undefined}>
                    {label}
                    {required && <span className="touch-checkbox-required" aria-label="required">*</span>}
                </div>
                {description && (
                    <div
                        className="touch-checkbox-description"
                        id={id ? `${id}-description` : undefined}
                    >
                        {description}
                    </div>
                )}
            </div>
        </div>
    );
}
