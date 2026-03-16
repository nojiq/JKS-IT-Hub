import { useState } from 'react';
import { useRevealPassword } from '../hooks/useCredentials.js';
import './CredentialHistory.css';

/**
 * CredentialRevealer Component
 * 
 * Password reveal component with secure access controls.
 * Requires user confirmation before revealing password.
 * 
 * @param {Object} props
 * @param {string} props.versionId - Version ID to reveal password for
 * @param {string} [props.maskedValue] - Default masked display value
 */
function CredentialRevealer({ versionId, maskedValue = '••••••••••••' }) {
  const [revealed, setRevealed] = useState(false);
  const [password, setPassword] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  const revealMutation = useRevealPassword();

  const handleRevealRequest = () => {
    setShowConfirmation(true);
  };

  const handleConfirmReveal = async () => {
    try {
      const result = await revealMutation.mutateAsync({ versionId });
      const revealedPassword = result?.data?.password?.revealed ?? null;
      if (typeof revealedPassword !== 'string') {
        throw new Error('Password reveal response missing value');
      }
      setPassword(revealedPassword);
      setRevealed(true);
      setShowConfirmation(false);
    } catch (error) {
      console.error('Failed to reveal password:', error);
    }
  };

  const handleCancelReveal = () => {
    setShowConfirmation(false);
  };

  const handleHide = () => {
    setRevealed(false);
    setPassword(null);
  };

  const copyToClipboard = () => {
    if (password) {
      navigator.clipboard.writeText(password);
    }
  };

  return (
    <div className="credential-revealer">
      <div className="password-display">
        <code className={`password-value ${revealed ? 'revealed' : 'masked'}`}>
          {revealed ? password : maskedValue}
        </code>
        
        {revealed ? (
          <div className="revealed-actions">
            <button
              className="btn-revealer"
              onClick={copyToClipboard}
              title="Copy to clipboard"
              aria-label="Copy password to clipboard"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button
              className="btn-revealer"
              onClick={handleHide}
              title="Hide password"
              aria-label="Hide password"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            </button>
          </div>
        ) : (
          <button
            className="btn-revealer"
            onClick={handleRevealRequest}
            title="Reveal password"
            aria-label="Reveal password"
            disabled={revealMutation.isPending}
          >
            {revealMutation.isPending ? (
              <span className="spinner-small"></span>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            )}
          </button>
        )}
      </div>

      {showConfirmation && (
        <div className="reveal-confirmation-overlay">
          <div className="reveal-confirmation-dialog">
            <h4>Reveal Password?</h4>
            <p>
              You are about to reveal a password from the credential history.
              This action will be logged for security purposes.
            </p>
            <div className="confirmation-actions">
              <button
                className="btn-cancel"
                onClick={handleCancelReveal}
              >
                Cancel
              </button>
              <button
                className="btn-confirm-reveal"
                onClick={handleConfirmReveal}
                disabled={revealMutation.isPending}
              >
                {revealMutation.isPending ? 'Revealing...' : 'Reveal Password'}
              </button>
            </div>
            {revealMutation.error && (
              <p className="reveal-error">
                {revealMutation.error.message || 'Failed to reveal password'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CredentialRevealer;
