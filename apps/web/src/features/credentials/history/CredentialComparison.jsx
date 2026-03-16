import { useEffect, useRef, useState } from 'react';
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
  const autoComparedKeyRef = useRef(null);
  
  const { data: version1Response, isLoading: loading1 } = useCredentialVersion(versionId1);
  const { data: version2Response, isLoading: loading2 } = useCredentialVersion(versionId2);
  const compareMutation = useCompareVersions();
  const version1 = version1Response?.data ?? null;
  const version2 = version2Response?.data ?? null;

  const handleCompare = async () => {
    try {
      const result = await compareMutation.mutateAsync({
        versionId1,
        versionId2
      });
      setComparisonResult(result?.data ?? null);
    } catch (error) {
      console.error('Comparison failed:', error);
    }
  };

  useEffect(() => {
    if (!versionId1 || !versionId2) return;
    const compareKey = `${versionId1}:${versionId2}`;
    setComparisonResult(null);
    if (autoComparedKeyRef.current === compareKey) return;
    autoComparedKeyRef.current = compareKey;
    void handleCompare();
    // We intentionally auto-compare once per version pair.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId1, versionId2]);

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

  const maskPassword = (version) => {
    if (!version?.password) return '—';
    if (typeof version.password === 'string') {
      return '•'.repeat(Math.min(version.password.length, 12));
    }
    return version.password.masked || '••••••••';
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
              <span className="version-date">{formatDate(version1?.timestamp)}</span>
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
                  {maskPassword(version1)}
                </span>
              </div>
              <div className="compare-field">
                <label>Template</label>
                <span className={isChanged('templateVersion') ? 'changed' : ''}>
                  {version1?.templateVersion == null ? '—' : `v${version1.templateVersion}`}
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
              <span className="version-date">{formatDate(version2?.timestamp)}</span>
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
                  {maskPassword(version2)}
                </span>
              </div>
              <div className="compare-field">
                <label>Template</label>
                <span className={isChanged('templateVersion') ? 'changed' : ''}>
                  {version2?.templateVersion == null ? '—' : `v${version2.templateVersion}`}
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
                      {Object.prototype.hasOwnProperty.call(diff, 'oldValue') || Object.prototype.hasOwnProperty.call(diff, 'newValue') ? (
                        <>
                          <code className="old-value">{String(diff.oldValue ?? '—')}</code>
                          <span className="diff-arrow">→</span>
                          <code className="new-value">{String(diff.newValue ?? '—')}</code>
                        </>
                      ) : (
                        <span>{diff.note || 'Value changed'}</span>
                      )}
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
