import React, { useState } from 'react';
import CredentialComparison from './CredentialComparison';
import './CredentialRegeneration.css';

/**
 * CredentialRegeneration Component
 * 
 * Main component for credential regeneration with confirmation workflow.
 * Handles preview, comparison display, and explicit confirmation.
 * 
 * Story 2.4 - AC1, AC2, AC3, AC5
 * 
 * @param {Object} props
 * @param {string} props.userId - Target user ID
 * @param {string} props.userName - Target user name for display
 * @param {Function} props.onInitiateRegeneration - API function to initiate regeneration
 * @param {Function} props.onConfirmRegeneration - API function to confirm regeneration
 * @param {Function} props.onCancel - Callback when user cancels
 * @param {Function} props.onSuccess - Callback when regeneration succeeds
 */
const CredentialRegeneration = ({
    userId,
    userName,
    onInitiateRegeneration,
    onConfirmRegeneration,
    onCancel,
    onSuccess
}) => {
    const [step, setStep] = useState('idle'); // idle, loading, preview, confirming, success, error
    const [previewData, setPreviewData] = useState(null);
    const [error, setError] = useState(null);
    const [acknowledged, setAcknowledged] = useState(false);
    const [result, setResult] = useState(null);

    const handleInitiate = async () => {
        setStep('loading');
        setError(null);

        try {
            const response = await onInitiateRegeneration({ userId });
            setPreviewData(response.data);
            setStep('preview');
        } catch (err) {
            setError(err);
            setStep('error');
        }
    };

    const handleConfirm = async () => {
        if (!acknowledged) return;

        setStep('confirming');
        setError(null);

        try {
            const response = await onConfirmRegeneration({
                userId,
                previewToken: previewData.previewToken,
                confirmed: true
            });
            setResult(response.data);
            setStep('success');
            onSuccess?.(response.data);
        } catch (err) {
            setError(err);
            setStep('error');
        }
    };

    const handleCancel = () => {
        setStep('idle');
        setPreviewData(null);
        setError(null);
        setAcknowledged(false);
        onCancel?.();
    };

    const getErrorDisplay = () => {
        if (!error) return null;

        // Handle RFC 9457 Problem Details
        if (error.problemDetails) {
            const { type, title, detail, status } = error.problemDetails;
            
            // Disabled user error
            if (type === '/problems/regeneration-blocked') {
                return {
                    title: 'Regeneration Blocked',
                    message: detail || 'Cannot regenerate credentials for this user.',
                    type: 'blocked',
                    resolution: error.problemDetails.resolution
                };
            }

            // No changes detected
            if (type === '/problems/no-changes-detected') {
                return {
                    title: 'No Changes Detected',
                    message: detail || 'LDAP data and template are unchanged.',
                    type: 'info',
                    suggestion: error.problemDetails.suggestion
                };
            }

            // Missing LDAP fields
            if (type === '/problems/credential-generation-failed') {
                return {
                    title: 'Generation Failed',
                    message: detail || 'Required LDAP fields are missing.',
                    type: 'error',
                    missingFields: error.problemDetails.missingFields
                };
            }

            // Preview expired
            if (type === '/problems/preview-expired') {
                return {
                    title: 'Session Expired',
                    message: detail || 'The preview session has expired.',
                    type: 'warning',
                    action: 'Please start the regeneration process again.'
                };
            }

            // Generic problem
            return {
                title: title || 'Error',
                message: detail || error.message || 'An error occurred.',
                type: 'error'
            };
        }

        // Generic error
        return {
            title: 'Error',
            message: error.message || 'An unexpected error occurred.',
            type: 'error'
        };
    };

    const errorDisplay = getErrorDisplay();

    // Idle State - Initial Trigger
    if (step === 'idle') {
        return (
            <div className="credential-regeneration">
                <div className="regeneration-intro">
                    <h3>Regenerate Credentials</h3>
                    <p className="user-target">
                        Target: <strong>{userName || userId}</strong>
                    </p>
                    <div className="regeneration-info">
                        <p>
                            This will regenerate credentials based on current LDAP data and the active template.
                            You'll see a comparison of old vs new credentials before confirming.
                        </p>
                        <ul className="regeneration-notes">
                            <li>Previous credentials will be preserved in history</li>
                            <li>Locked credentials will be skipped (if any)</li>
                            <li>Disabled users cannot have credentials regenerated</li>
                        </ul>
                    </div>
                    <div className="regeneration-actions">
                        <button 
                            className="btn btn-primary"
                            onClick={handleInitiate}
                        >
                            Start Regeneration
                        </button>
                        <button 
                            className="btn btn-secondary"
                            onClick={handleCancel}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Loading State
    if (step === 'loading') {
        return (
            <div className="credential-regeneration">
                <div className="regeneration-loading">
                    <div className="spinner"></div>
                    <p>Analyzing changes and generating comparison...</p>
                </div>
            </div>
        );
    }

    // Preview State - Show Comparison
    if (step === 'preview' && previewData) {
        return (
            <div className="credential-regeneration">
                <div className="regeneration-preview">
                    <h3>Review Credential Changes</h3>
                    <p className="preview-subtitle">
                        Compare current credentials with newly generated ones
                    </p>

                    <CredentialComparison 
                        comparisons={previewData.comparisons}
                        changeType={previewData.changeType}
                        changedLdapFields={previewData.changedLdapFields}
                    />

                    <div className="confirmation-section">
                        <div className="warning-box">
                            <div className="warning-icon">⚠️</div>
                            <div className="warning-content">
                                <h4>Important Notice</h4>
                                <p>
                                    This will overwrite existing active credentials. 
                                    Previous credentials will be preserved in history with reason "regeneration".
                                </p>
                            </div>
                        </div>

                        <div className="acknowledgment-checkbox">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={acknowledged}
                                    onChange={(e) => setAcknowledged(e.target.checked)}
                                />
                                <span className="checkbox-text">
                                    I understand and want to regenerate credentials
                                </span>
                            </label>
                        </div>

                        <div className="regeneration-actions">
                            <button 
                                className="btn btn-primary btn-confirm"
                                onClick={handleConfirm}
                                disabled={!acknowledged}
                            >
                                Confirm Regeneration
                            </button>
                            <button 
                                className="btn btn-secondary"
                                onClick={handleCancel}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Confirming State
    if (step === 'confirming') {
        return (
            <div className="credential-regeneration">
                <div className="regeneration-loading">
                    <div className="spinner"></div>
                    <p>Applying changes and preserving history...</p>
                </div>
            </div>
        );
    }

    // Success State
    if (step === 'success' && result) {
        return (
            <div className="credential-regeneration">
                <div className="regeneration-success">
                    <div className="success-icon">✓</div>
                    <h3>Credentials Regenerated Successfully</h3>
                    
                    <div className="success-details">
                        <div className="detail-row">
                            <span className="detail-label">Change Type:</span>
                            <span className="detail-value">{result.changeType}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Systems Updated:</span>
                            <span className="detail-value">
                                {result.regeneratedCredentials.length}
                            </span>
                        </div>
                        {result.preservedHistory.length > 0 && (
                            <div className="detail-row">
                                <span className="detail-label">History Preserved:</span>
                                <span className="detail-value">
                                    {result.preservedHistory.length} previous versions
                                </span>
                            </div>
                        )}
                        {result.skippedCredentials.length > 0 && (
                            <div className="detail-row">
                                <span className="detail-label">Skipped (Locked):</span>
                                <span className="detail-value">
                                    {result.skippedCredentials.length} credentials
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="regeneration-actions">
                        <button 
                            className="btn btn-primary"
                            onClick={handleCancel}
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Error State
    if (step === 'error' && errorDisplay) {
        const errorClass = `error-${errorDisplay.type}`;
        
        return (
            <div className="credential-regeneration">
                <div className={`regeneration-error ${errorClass}`}>
                    <div className="error-icon">
                        {errorDisplay.type === 'blocked' && '🚫'}
                        {errorDisplay.type === 'info' && 'ℹ️'}
                        {errorDisplay.type === 'warning' && '⚠️'}
                        {errorDisplay.type === 'error' && '❌'}
                    </div>
                    <h3>{errorDisplay.title}</h3>
                    <p className="error-message">{errorDisplay.message}</p>
                    
                    {errorDisplay.resolution && (
                        <div className="error-resolution">
                            <strong>Resolution:</strong> {errorDisplay.resolution}
                        </div>
                    )}
                    
                    {errorDisplay.suggestion && (
                        <div className="error-suggestion">
                            <strong>Suggestion:</strong> {errorDisplay.suggestion}
                        </div>
                    )}
                    
                    {errorDisplay.missingFields && (
                        <div className="error-missing-fields">
                            <strong>Missing Fields:</strong>
                            <ul>
                                {errorDisplay.missingFields.map(field => (
                                    <li key={field}>{field}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    {errorDisplay.action && (
                        <p className="error-action">{errorDisplay.action}</p>
                    )}

                    <div className="regeneration-actions">
                        {errorDisplay.type === 'warning' || errorDisplay.type === 'preview-expired' ? (
                            <button 
                                className="btn btn-primary"
                                onClick={handleInitiate}
                            >
                                Try Again
                            </button>
                        ) : null}
                        <button 
                            className="btn btn-secondary"
                            onClick={handleCancel}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default CredentialRegeneration;
