import './DisabledUserBanner.css';

/**
 * DisabledUserBanner Component
 * 
 * Reusable warning banner displayed when viewing a disabled user's profile.
 * Blocks credential operations and provides enable option if user has permission.
 * 
 * Story 2.10 - AC4, AC5
 * 
 * @param {Object} props
 * @param {string} props.userName - Name of the disabled user for display
 * @param {string} props.userStatus - Current user status (should be 'disabled')
 * @param {Function} props.onEnableUser - Optional callback to enable the user
 * @param {boolean} props.canEnableUser - Whether current user has permission to enable users
 */
const DisabledUserBanner = ({ 
    userName, 
    userStatus,
    onEnableUser,
    canEnableUser = false 
}) => {
    // Only show if user is actually disabled
    if (userStatus !== 'disabled') {
        return null;
    }

    return (
        <div className="disabled-user-banner" data-testid="disabled-user-banner">
            <div className="banner-icon">
                🚫
            </div>
            <div className="banner-content">
                <h4 className="banner-title">Credential Operations Blocked</h4>
                <p className="banner-message">
                    <strong>{userName}</strong> is currently disabled. Credential generation, 
                    regeneration, and overrides are not allowed for disabled users.
                </p>
                <div className="banner-actions">
                    {canEnableUser && onEnableUser && (
                        <button 
                            className="btn-enable-user"
                            onClick={onEnableUser}
                            data-testid="enable-user-button"
                        >
                            Enable User
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DisabledUserBanner;
