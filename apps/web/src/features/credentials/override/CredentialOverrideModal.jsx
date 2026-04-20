import { useEffect, useState } from 'react';
import './CredentialOverrideModal.css';

const IMAP_FIELDS = [
    { key: 'email', label: 'Email', ldapKey: 'mail' },
    { key: 'firstName', label: 'First Name', ldapKey: 'givenName' },
    { key: 'lastName', label: 'Last Name', ldapKey: 'sn' },
    { key: 'fullName', label: 'Full Name', ldapKey: 'cn' },
    { key: 'dob', label: 'Date of Birth', ldapKey: 'birthDate' },
    { key: 'phone', label: 'Phone Number', ldapKey: 'telephoneNumber' }
];

const DEFAULT_IMAP_REASON = 'Deterministic IMAP password update';

const createEmptyFieldState = () => {
    return IMAP_FIELDS.reduce((state, field) => {
        state[field.key] = '';
        return state;
    }, {});
};

const createDefaultSelectedFields = (fieldValues, metadata) => {
    const metadataSelection = metadata?.selectedFields ?? [];

    return IMAP_FIELDS.reduce((state, field) => {
        if (metadataSelection.length > 0) {
            state[field.key] = metadataSelection.includes(field.key);
            return state;
        }

        state[field.key] = field.key === 'email' && Boolean(fieldValues[field.key]);
        return state;
    }, {});
};

const createDefaultOrigins = (fieldValues, metadata) => {
    const metadataOrigins = metadata?.origins ?? {};

    return IMAP_FIELDS.reduce((state, field) => {
        state[field.key] = metadataOrigins[field.key] || (fieldValues[field.key] ? 'ldap' : 'manual');
        return state;
    }, {});
};

const getImapFieldValues = (ldapFields = {}) => {
    return IMAP_FIELDS.reduce((state, field) => {
        state[field.key] = String(ldapFields[field.ldapKey] ?? '').trim();
        return state;
    }, {});
};

const getChangedFieldLabels = (changedFields = []) => {
    return changedFields
        .map((fieldKey) => IMAP_FIELDS.find((field) => field.key === fieldKey)?.label)
        .filter(Boolean);
};

const CredentialOverrideModal = ({
    isOpen,
    onClose,
    credential,
    userId,
    ldapFields,
    onPreview,
    onConfirm,
    isLoading,
    userStatus,
    onEnableUser,
    canEnableUser
}) => {
    const isUserDisabled = userStatus === 'Disabled' || userStatus === 'disabled';
    const isImapCredential = credential?.system === 'imap';
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [reason, setReason] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState(null);
    const [imapInputs, setImapInputs] = useState(createEmptyFieldState);
    const [imapSelectedFields, setImapSelectedFields] = useState(createEmptyFieldState);
    const [imapOrigins, setImapOrigins] = useState(createEmptyFieldState);
    const [initialImapInputs, setInitialImapInputs] = useState(createEmptyFieldState);

    useEffect(() => {
        if (!isOpen || !credential) return;

        setUsername(credential.username || '');
        setPassword('');
        setShowPassword(false);
        setPreview(null);
        setError(null);

        if (!isImapCredential) {
            setReason('');
            return;
        }

        const nextInputs = getImapFieldValues(ldapFields);
        setInitialImapInputs(nextInputs);
        setImapInputs(nextInputs);
        setImapSelectedFields(createDefaultSelectedFields(nextInputs, credential.metadata));
        setImapOrigins(createDefaultOrigins(nextInputs, credential.metadata));
        setReason(DEFAULT_IMAP_REASON);
    }, [isOpen, credential, credential?.id, credential?.username, credential?.metadata, isImapCredential, ldapFields]);

    useEffect(() => {
        if (!isOpen || !credential || !isImapCredential || isUserDisabled) return undefined;

        const hasSelectedFields = Object.values(imapSelectedFields).some(Boolean);
        if (!hasSelectedFields || reason.trim().length < 10) {
            setPreview(null);
            return undefined;
        }

        let cancelled = false;

        const previewTimer = window.setTimeout(async () => {
            try {
                const result = await onPreview(userId, credential.system, {
                    mode: 'imap_deterministic',
                    reason: reason.trim(),
                    inputs: imapInputs,
                    selectedFields: imapSelectedFields,
                    origins: imapOrigins
                });

                if (!cancelled) {
                    setPreview(result.data);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setPreview(null);
                    setError(err.problemDetails?.detail || err.message || 'Failed to preview IMAP password');
                }
            }
        }, 250);

        return () => {
            cancelled = true;
            window.clearTimeout(previewTimer);
        };
    }, [credential, imapInputs, imapOrigins, imapSelectedFields, isImapCredential, isOpen, isUserDisabled, onPreview, reason, userId]);

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

    const handleImapInputChange = (fieldKey, value) => {
        setImapInputs((current) => ({
            ...current,
            [fieldKey]: value
        }));

        setImapOrigins((current) => ({
            ...current,
            [fieldKey]: value === initialImapInputs[fieldKey] && initialImapInputs[fieldKey] ? 'ldap' : 'manual'
        }));
    };

    const handleImapSelectedFieldChange = (fieldKey, checked) => {
        setImapSelectedFields((current) => ({
            ...current,
            [fieldKey]: checked
        }));
    };

    const changedFieldLabels = getChangedFieldLabels(preview?.changes?.changedFields);

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>
                        {isUserDisabled
                            ? 'Override Blocked - User Disabled'
                            : isImapCredential
                                ? 'Generate Deterministic IMAP Password'
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

                            {isImapCredential ? (
                                <>
                                    <div className="section">
                                        <h3>Password Inputs</h3>
                                        <p className="hint imap-helper-copy">
                                            Toggle the LDAP-prefilled fields that should participate. The password preview updates as you edit.
                                        </p>
                                        <div className="imap-input-grid">
                                            {IMAP_FIELDS.map((field) => (
                                                <div className="imap-input-card" key={field.key}>
                                                    <label className="imap-toggle-label">
                                                        <input
                                                            type="checkbox"
                                                            aria-label={field.key === 'phone' ? `Use ${field.label}` : 'Toggle field participation'}
                                                            checked={Boolean(imapSelectedFields[field.key])}
                                                            onChange={(event) => handleImapSelectedFieldChange(field.key, event.target.checked)}
                                                        />
                                                        <span aria-hidden="true">{`Use ${field.label}`}</span>
                                                    </label>
                                                    <label htmlFor={`imap-${field.key}`}>{field.label}</label>
                                                    <input
                                                        id={`imap-${field.key}`}
                                                        type="text"
                                                        value={imapInputs[field.key] || ''}
                                                        onChange={(event) => handleImapInputChange(field.key, event.target.value)}
                                                        className="form-input"
                                                    />
                                                    <small className="hint">Source: {imapOrigins[field.key] === 'ldap' ? 'LDAP prefill' : 'Manual edit'}</small>
                                                </div>
                                            ))}
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
                                </>
                            ) : (
                                <>
                                    <div className="section">
                                        <h3>New Values</h3>
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
                                </>
                            )}

                            {error && (
                                <div className="error-message">
                                    <span className="error-icon">!</span>
                                    {error}
                                </div>
                            )}

                            {preview && (
                                <div className="section preview-section">
                                    <h3>{isImapCredential ? 'Live Password Preview' : 'Preview Changes'}</h3>
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
                                        {isImapCredential && (
                                            <div className="change-row reason-row">
                                                <span className="change-label">Information Changed:</span>
                                                <span className="change-value imap-changed-fields">
                                                    {changedFieldLabels.length > 0 ? changedFieldLabels.join(', ') : 'None'}
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

                            {!isImapCredential && !preview ? (
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
                                    {isLoading ? 'Processing...' : isImapCredential ? 'Save IMAP Credential' : 'Confirm Override'}
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
