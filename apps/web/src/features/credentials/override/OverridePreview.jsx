import React from 'react';
import './CredentialOverrideModal.css';

const OverridePreview = ({ preview, reason }) => {
    if (!preview) return null;

    const { currentCredential, proposedCredential, changes } = preview;

    return (
        <div className="preview-section">
            <h3>Preview Changes</h3>
            <div className="preview-content">
                <div className="change-row">
                    <span className="change-label">Username:</span>
                    <span className="change-value">
                        {changes?.usernameChanged ? (
                            <>
                                <span className="old-value">{currentCredential?.username}</span>
                                <span className="arrow">→</span>
                                <span className="new-value">{proposedCredential?.username}</span>
                                <span className="badge changed">CHANGED</span>
                            </>
                        ) : (
                            <>
                                <span>{currentCredential?.username}</span>
                                <span className="badge unchanged">unchanged</span>
                            </>
                        )}
                    </span>
                </div>
                <div className="change-row">
                    <span className="change-label">Password:</span>
                    <span className="change-value">
                        {changes?.passwordChanged ? (
                            <>
                                <span className="new-value">••••••••</span>
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
            </div>
            <div className="warning-box">
                <span className="warning-icon">⚠️</span>
                This action cannot be undone. The previous credential will be preserved in history.
            </div>
        </div>
    );
};

export default OverridePreview;