import { useState } from 'react';
import './CredentialPreview.css';

/**
 * SystemCredentials Component
 * 
 * Displays credentials for a single system with password masking/reveal toggle.
 * Updated for Story 2.7: Shows username field source and fallback warnings.
 * 
 * @param {Object} props
 * @param {string} props.system - System name (e.g., 'email', 'vpn')
 * @param {Array} props.credentials - Array of credential objects for this system
 * @param {string} props.credentials[].username - Username for the credential
 * @param {string} props.credentials[].password - Password for the credential
 * @param {string} props.credentials[].ldapSources - Object mapping field names to LDAP source fields
 * @param {Object} props.credentials[].generationMetadata - Metadata about how credential was generated (Story 2.7)
 * @param {string} props.credentials[].generationMetadata.usernameField - LDAP field used for username
 * @param {boolean} props.credentials[].generationMetadata.usingDefault - Whether default fallback was used
 * @param {boolean} props.credentials[].generationMetadata.normalized - Whether normalization was applied
 */
function SystemCredentials({ system, credentials }) {
  const [revealedPasswords, setRevealedPasswords] = useState({});

  const togglePassword = (index) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  // Format system name for display
  const formatSystemName = (name) => {
    return name
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get generation metadata from first credential (applies to all in system)
  const metadata = credentials[0]?.generationMetadata;

  return (
    <div className="system-credentials">
      <h3 className="system-name">{formatSystemName(system)}</h3>
      
      {/* Story 2.7: Show username field source and fallback warning */}
      {metadata && (
        <div className={`generation-metadata ${metadata.usingDefault ? 'fallback-warning' : ''}`}>
          <div className="metadata-row">
            <span className="metadata-label">Username Source:</span>
            <span className="metadata-value">
              {metadata.usernameField || 'mail'}
              {metadata.usingDefault && (
                <span className="fallback-badge" title="No system configuration found, using default">
                  ⚠️ Default
                </span>
              )}
            </span>
          </div>
          {metadata.normalized && (
            <div className="metadata-row">
              <span className="metadata-label">Normalization:</span>
              <span className="metadata-value normalized-badge">
                ✓ Applied
              </span>
            </div>
          )}
        </div>
      )}

      {/* Fallback warning banner */}
      {metadata?.usingDefault && (
        <div className="fallback-warning-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>
            No system configuration found for '{system}'. Using default 'mail' field for username.
            <a href="/system-configs" target="_blank" rel="noopener noreferrer">
              Configure system →
            </a>
          </span>
        </div>
      )}
      
      <div className="credentials-table">
        {credentials.map((cred, index) => (
          <div key={index} className="credential-row">
            <div className="credential-field">
              <label>Username</label>
              <div className="credential-value">
                <span className="username">{cred.username}</span>
                <button 
                  className="btn-copy"
                  onClick={() => copyToClipboard(cred.username)}
                  title="Copy username"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
            </div>

            <div className="credential-field">
              <label>Password</label>
              <div className="credential-value password-field">
                <span className="password">
                  {revealedPasswords[index] ? cred.password : '••••••••••••'}
                </span>
                <div className="password-actions">
                  <button 
                    className="btn-reveal"
                    onClick={() => togglePassword(index)}
                    title={revealedPasswords[index] ? 'Hide password' : 'Show password'}
                  >
                    {revealedPasswords[index] ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                  <button 
                    className="btn-copy"
                    onClick={() => copyToClipboard(cred.password)}
                    title="Copy password"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {cred.ldapSources && Object.keys(cred.ldapSources).length > 0 && (
              <div className="ldap-sources">
                <label>LDAP Sources</label>
                <div className="sources-list">
                  {Object.entries(cred.ldapSources).map(([field, source]) => (
                    <span key={field} className="source-tag">
                      {field}: {source}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default SystemCredentials;