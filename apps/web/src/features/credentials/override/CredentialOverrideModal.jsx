import { useEffect, useState } from 'react';
import './CredentialOverrideModal.css';

const CredentialOverrideModal = ({
    isOpen,
    onClose,
    credential,
    userId,
    ldapFields: _ldapFields,
    onPreview,
    onConfirm,
    isLoading,
    userStatus,
    onEnableUser,
    canEnableUser
}) => {
    const isUserDisabled = userStatus === 'Disabled' || userStatus === 'disabled';
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [reason, setReason] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isOpen || !credential) return;

        setUsername(credential.username || '');
        setPassword('');
        setShowPassword(false);
        setPreview(null);
        setError(null);
        setReason('');
    }, [isOpen, credential, credential?.id, credential?.username]);

    if (!isOpen || !credential) return null;

    const handleEnableUser = async () => {
        if (onEnableUser) {
            await onEnableUser(userId);
        }
    };

    const handlePreview = async () => {
        setError(null);

        if (!reason || reason.length < 10) {
            setError('Reason must be at least 10 characters');
            return;
        }

        if (!username && !password) {
            setError('At least one of username or password must be provided');
            return;
        }

        try {
            const overrideData = {
                ...(username && username !== credential.username && { username }),
                ...(password && { password }),
                reason
            };

            const result = await onPreview(userId, credential.system, overrideData);
            setPreview(result.data);
        } catch (err) {
            setError(err.problemDetails?.detail || err.message || 'Failed to preview override');
        }
    };

    const handleConfirm = async () => {
        if (!preview?.previewToken) return;

        try {
            await onConfirm(userId, credential.system, preview.previewToken);
            onClose();
        } catch (err) {
            setError(err.problemDetails?.detail || err.message || 'Failed to confirm override');
        }
    };

    const handleClose = () => {
        setPreview(null);
        setError(null);
        onClose();
    };

    const changedFieldLabels = (preview?.changes?.changedFields || [])
        .map((fieldKey) => {
            const labels = {
                email: 'Email address',
                firstName: 'First name',
                lastName: 'Last name',
                fullName: 'Full name',
                dob: 'Date of birth',
                phone: 'Phone number'
            };
            return labels[fieldKey];
        })
        .filter(Boolean);

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content credential-override" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>
                        {isUserDisabled
                            ? 'Override Blocked - User Disabled'
                            : `Override Credential: ${credential.system}`}
                    </h2>
                    <button className="btn-close" onClick={handleClose}>x</button>
                </div>

                <div className="modal-body">
                    {isUserDisabled ? (
                        <div className="disabled-user-blocked">
                            <div className="warning-banner">
                                <span className="warning-icon">!</span>
                                <div className="warning-content">
                                    <strong>Override Blocked</strong>
                                    <p>Credential override is not allowed for disabled users. Please enable the user first.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="section">
                                <h3>Current Credential</h3>
                                <div className="credential-info">
                                    <div className="info-row">
                                        <label>Username:</label>
                                        <span>{credential.username}</span>
                                    </div>
                                    <div className="info-row">
                                        <label>Password:</label>
                                        <span className="masked">........</span>
                                    </div>
                                </div>
                            </div>

                            <div className="section">
                                <h3>New Values</h3>
                                <p className="hint imap-helper-copy">
                                    For IMAP, enter the username and password exactly as provided by the email host.
                                </p>
                                <div className="form-group">
                                    <label htmlFor="override-username">Username:</label>
                                    <input
                                        id="override-username"
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder={credential.username}
                                        className="form-input"
                                    />
                                    <small className="hint">Pre-filled, editable. Leave blank to keep current.</small>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="override-password">Password:</label>
                                    <div className="password-input-group">
                                        <input
                                            id="override-password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Leave blank to keep current"
                                            className="form-input"
                                        />
                                        <button
                                            type="button"
                                            className="btn-toggle-password"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? 'Hide' : 'Show'}
                                        </button>
                                    </div>
                                    <small className="hint">Optional, leave blank to keep current password</small>
                                </div>
                            </div>

                            <div className="section">
                                <label htmlFor="override-reason" className="required">
                                    Reason for Override *
                                </label>
                                <textarea
                                    id="override-reason"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Enter a detailed reason for this override (minimum 10 characters required)..."
                                    className="form-textarea"
                                    rows={4}
                                    minLength={10}
                                    required
                                />
                                <small className="char-count">
                                    {reason.length} characters (minimum 10)
                                </small>
                            </div>

                            {error && (
                                <div className="error-message">
                                    <span className="error-icon">!</span>
                                    {error}
                                </div>
                            )}

                            {preview && (
                                <div className="section preview-section">
                                    <h3>Preview Changes</h3>
                                    <div className="preview-content">
                                        <div className="change-row">
                                            <span className="change-label">Username:</span>
                                            <span className="change-value">
                                                {preview.changes?.usernameChanged ? (
                                                    <>
                                                        <span className="old-value">{preview.currentCredential?.username}</span>
                                                        <span className="arrow">to</span>
                                                        <span className="new-value">{preview.proposedCredential?.username}</span>
                                                        <span className="badge changed">CHANGED</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>{preview.currentCredential?.username}</span>
                                                        <span className="badge unchanged">unchanged</span>
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                        <div className="change-row">
                                            <span className="change-label">Password:</span>
                                            <span className="change-value">
                                                {preview.changes?.passwordChanged ? (
                                                    <>
                                                        <span className="new-value imap-password-preview">{preview.proposedCredential?.password}</span>
                                                        <span className="badge changed">CHANGED</span>
                                                    </>
                                                ) : (
                                                    <span className="badge unchanged">unchanged</span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="change-row reason-row">
                                            <span className="change-label">Reason:</span>
                                            <span className="change-value reason-text">{reason}</span>
                                        </div>
                                        {changedFieldLabels.length > 0 && (
                                            <div className="change-row reason-row">
                                                <span className="change-label">Information Changed:</span>
                                                <span className="change-value imap-changed-fields">
                                                    {changedFieldLabels.join(', ')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="warning-box">
                                        <span className="warning-icon">!</span>
                                        This action cannot be undone. The previous credential will be preserved in history.
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    {isUserDisabled ? (
                        <>
                            {onEnableUser && canEnableUser && (
                                <button
                                    className="btn-enable-user"
                                    onClick={handleEnableUser}
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Enabling...' : 'Enable User'}
                                </button>
                            )}
                            <button
                                className="btn-close-modal"
                                onClick={handleClose}
                                disabled={isLoading}
                            >
                                Close
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                className="btn-cancel"
                                onClick={handleClose}
                                disabled={isLoading}
                            >
                                Cancel
                            </button>

                            {!preview ? (
                                <button
                                    className="btn-preview"
                                    onClick={handlePreview}
                                    disabled={isLoading || !reason || reason.length < 10}
                                >
                                    {isLoading ? 'Loading...' : 'Preview Changes'}
                                </button>
                            ) : (
                                <button
                                    className="btn-confirm-override"
                                    onClick={handleConfirm}
                                    disabled={isLoading || !preview?.previewToken || reason.trim().length < 10}
                                >
                                    {isLoading ? 'Processing...' : 'Confirm Override'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CredentialOverrideModal;
