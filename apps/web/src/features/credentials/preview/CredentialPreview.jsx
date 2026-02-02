import { useState } from 'react';
import './CredentialPreview.css';
import SystemCredentials from './SystemCredentials.jsx';
import ConfirmationForm from './ConfirmationForm.jsx';

/**
 * CredentialPreview Component
 * 
 * Displays a preview of generated credentials before confirmation.
 * Features:
 * - System grouping with clear labeling
 * - Password masking with reveal toggle
 * - Template version and LDAP source display
 * - Explicit confirmation UI
 * - Cancel/discard functionality
 * 
 * @param {Object} props
 * @param {Object} props.previewData - Preview data from API
 * @param {string} props.previewData.userId - User ID
 * @param {Array} props.previewData.credentials - Array of credential objects
 * @param {number} props.previewData.templateVersion - Template version used
 * @param {string} props.previewData.previewToken - Token for confirmation
 * @param {string} props.previewData.expiresAt - ISO timestamp when preview expires
 * @param {Function} props.onConfirm - Callback when user confirms (passes previewToken)
 * @param {Function} props.onCancel - Callback when user cancels
 * @param {boolean} props.isLoading - Whether confirmation is in progress
 * @param {Error} props.error - Error object if confirmation failed
 */
function CredentialPreview({ previewData, onConfirm, onCancel, isLoading, error }) {
  const { userId, credentials, templateVersion, previewToken, expiresAt } = previewData;
  const [confirmed, setConfirmed] = useState(false);
  
  // Group credentials by system
  const credentialsBySystem = credentials.reduce((acc, cred) => {
    if (!acc[cred.system]) {
      acc[cred.system] = [];
    }
    acc[cred.system].push(cred);
    return acc;
  }, {});

  // Calculate time remaining
  const getTimeRemaining = () => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry - now;
    const diffMins = Math.ceil(diffMs / 60000);
    return Math.max(0, diffMins);
  };

  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining());

  // Update time remaining every minute
  useState(() => {
    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining());
    }, 60000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleConfirm = () => {
    if (confirmed && !isLoading) {
      onConfirm(previewToken);
    }
  };

  return (
    <div className="credential-preview-overlay">
      <div className="credential-preview-modal">
        <header className="credential-preview-header">
          <h2>Preview Credentials</h2>
          <div className="preview-meta">
            <span className="template-version">Template v{templateVersion}</span>
            <span className={`expiry-warning ${timeRemaining < 2 ? 'urgent' : ''}`}>
              Expires in {timeRemaining} min
            </span>
          </div>
        </header>

        <div className="credential-preview-content">
          <div className="preview-notice">
            <p>
              Please review all credentials carefully before confirming. 
              Once confirmed, credentials will be saved and activated immediately.
            </p>
          </div>

          {error && (
            <div className="preview-error">
              <strong>Error:</strong> {error.message || 'Failed to save credentials'}
              {error.problemDetails?.detail && (
                <p>{error.problemDetails.detail}</p>
              )}
            </div>
          )}

          <div className="credentials-list">
            {Object.entries(credentialsBySystem).map(([system, systemCreds]) => (
              <SystemCredentials 
                key={system} 
                system={system} 
                credentials={systemCreds}
              />
            ))}
          </div>

          <ConfirmationForm 
            confirmed={confirmed}
            onConfirmedChange={setConfirmed}
            disabled={isLoading}
          />
        </div>

        <footer className="credential-preview-footer">
          <button 
            className="btn-cancel"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            className="btn-confirm"
            onClick={handleConfirm}
            disabled={!confirmed || isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Credentials'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default CredentialPreview;
