import { useState } from 'react';
import { useCompareVersions, useCredentialVersion } from '../hooks/useCredentials.js';
import './CredentialHistory.css';

/**
 * CredentialComparison Component
 * 
 * Side-by-side comparison view for two credential versions.
 * 
 * @param {Object} props
 * @param {string} props.versionId1 - First version ID
 * @param {string} props.versionId2 - Second version ID
 * @param {Function} props.onClose - Callback to close comparison
 */
function CredentialComparison({ versionId1, versionId2, onClose }) {
  const [comparisonResult, setComparisonResult] = useState(null);
  
  const { data: version1, isLoading: loading1 } = useCredentialVersion(versionId1);
  const { data: version2, isLoading: loading2 } = useCredentialVersion(versionId2);
  const compareMutation = useCompareVersions();

  const handleCompare = async () => {
    try {
      const result = await compareMutation.mutateAsync({
        versionId1,
        versionId2
      });
      setComparisonResult(result);
    } catch (error) {
      console.error('Comparison failed:', error);
    }
  };

  if (loading1 || loading2) {
    return (
      <div className="comparison-container">
        <div className="comparison-loading">
          <div className="loading-spinner"></div>
          <p>Loading versions...</p>
        </div>
      </div>
    );
  }

  const maskPassword = (password) => {
    if (!password) return '—';
    return '•'.repeat(Math.min(password.length, 12));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getChanges = (field) => {
    if (!comparisonResult) return [];
    return comparisonResult.differences?.filter(d => d.field === field) || [];
  };

  const isChanged = (field) => getChanges(field).length > 0;

  return (
    <div className="comparison-container">
      <header className="comparison-header">
        <h3>Compare Versions</h3>
        <button
          className="btn-close-comparison"
          onClick={onClose}
          aria-label="Close comparison"
        >
          ✕
        </button>
      </header>

      <div className="comparison-content">
        <div className="comparison-versions">
          <div className="version-column">
            <div className="version-header">
              <h4>Version {version1?.id}</h4>
              <span className="version-date">{formatDate(version1?.createdAt)}</span>
            </div>
            <div className="version-details">
              <div className="compare-field">
                <label>System</label>
                <span className={isChanged('system') ? 'changed' : ''}>
                  {version1?.system}
                </span>
              </div>
              <div className="compare-field">
                <label>Username</label>
                <span className={isChanged('username') ? 'changed' : ''}>
                  {version1?.username}
                </span>
              </div>
              <div className="compare-field">
                <label>Password</label>
                <span className={`masked ${isChanged('password') ? 'changed' : ''}`}>
                  {maskPassword(version1?.password)}
                </span>
              </div>
              <div className="compare-field">
                <label>Template</label>
                <span className={isChanged('templateVersion') ? 'changed' : ''}>
                  v{version1?.templateVersion}
                </span>
              </div>
              <div className="compare-field">
                <label>Reason</label>
                <span>{version1?.reason}</span>
              </div>
            </div>
          </div>

          <div className="comparison-divider">
            <div className="compare-indicator">VS</div>
          </div>

          <div className="version-column">
            <div className="version-header">
              <h4>Version {version2?.id}</h4>
              <span className="version-date">{formatDate(version2?.createdAt)}</span>
            </div>
            <div className="version-details">
              <div className="compare-field">
                <label>System</label>
                <span className={isChanged('system') ? 'changed' : ''}>
                  {version2?.system}
                </span>
              </div>
              <div className="compare-field">
                <label>Username</label>
                <span className={isChanged('username') ? 'changed' : ''}>
                  {version2?.username}
                </span>
              </div>
              <div className="compare-field">
                <label>Password</label>
                <span className={`masked ${isChanged('password') ? 'changed' : ''}`}>
                  {maskPassword(version2?.password)}
                </span>
              </div>
              <div className="compare-field">
                <label>Template</label>
                <span className={isChanged('templateVersion') ? 'changed' : ''}>
                  v{version2?.templateVersion}
                </span>
              </div>
              <div className="compare-field">
                <label>Reason</label>
                <span>{version2?.reason}</span>
              </div>
            </div>
          </div>
        </div>

        {comparisonResult ? (
          <div className="comparison-result">
            <h4>Differences</h4>
            {comparisonResult.differences?.length === 0 ? (
              <p className="no-differences">No differences found between these versions.</p>
            ) : (
              <ul className="differences-list">
                {comparisonResult.differences.map((diff, index) => (
                  <li key={index} className="difference-item">
                    <span className="diff-field">{diff.field}</span>
                    <span className="diff-change">
                      <code className="old-value">{diff.oldValue}</code>
                      <span className="diff-arrow">→</span>
                      <code className="new-value">{diff.newValue}</code>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="comparison-action">
            <button
              className="btn-run-comparison"
              onClick={handleCompare}
              disabled={compareMutation.isPending}
            >
              {compareMutation.isPending ? 'Comparing...' : 'Run Comparison'}
            </button>
            {compareMutation.error && (
              <p className="comparison-error">
                Failed to compare: {compareMutation.error.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CredentialComparison;
