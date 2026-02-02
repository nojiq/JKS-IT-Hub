import React from 'react';
import './CredentialComparison.css';

/**
 * CredentialComparison Component
 * 
 * Displays a side-by-side comparison of old vs new credentials
 * with change highlighting and locked credential indicators.
 * 
 * Story 2.4 - AC1, AC2, AC4
 */
const CredentialComparison = ({ comparisons, changeType, changedLdapFields }) => {
    const getChangeTypeLabel = () => {
        switch (changeType) {
            case 'ldap_update':
                return 'LDAP Data Changed';
            case 'template_change':
                return 'Template Updated';
            case 'both':
                return 'LDAP & Template Changed';
            default:
                return 'Changes Detected';
        }
    };

    const getChangeTypeClass = () => {
        switch (changeType) {
            case 'ldap_update':
                return 'change-type-ldap';
            case 'template_change':
                return 'change-type-template';
            case 'both':
                return 'change-type-both';
            default:
                return '';
        }
    };

    const maskPassword = (password) => {
        if (!password) return '—';
        return '•'.repeat(Math.min(password.length, 12));
    };

    const hasChanges = (comparison) => {
        return comparison.changes && comparison.changes.length > 0;
    };

    return (
        <div className="credential-comparison">
            {/* Change Summary Banner */}
            <div className={`change-summary-banner ${getChangeTypeClass()}`}>
                <div className="change-summary-header">
                    <span className="change-type-badge">{getChangeTypeLabel()}</span>
                </div>
                {changedLdapFields && changedLdapFields.length > 0 && (
                    <div className="changed-fields">
                        <span className="changed-fields-label">Changed LDAP Fields:</span>
                        <span className="changed-fields-list">
                            {changedLdapFields.join(', ')}
                        </span>
                    </div>
                )}
            </div>

            {/* Comparison Table */}
            <div className="comparison-table-container">
                <table className="comparison-table">
                    <thead>
                        <tr>
                            <th className="system-column">System</th>
                            <th className="old-column">Current Credentials</th>
                            <th className="arrow-column"></th>
                            <th className="new-column">New Credentials</th>
                            <th className="status-column">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {comparisons.map((comparison, index) => (
                            <tr 
                                key={comparison.system} 
                                className={`comparison-row ${hasChanges(comparison) ? 'has-changes' : ''} ${comparison.skipped ? 'skipped' : ''}`}
                            >
                                <td className="system-cell">
                                    <span className="system-name">{comparison.system}</span>
                                </td>
                                <td className="old-cell">
                                    {comparison.old ? (
                                        <div className="credential-data">
                                            <div className="credential-field">
                                                <span className="field-label">Username:</span>
                                                <span className="field-value">{comparison.old.username}</span>
                                            </div>
                                            <div className="credential-field">
                                                <span className="field-label">Password:</span>
                                                <span className="field-value masked">{maskPassword(comparison.old.password)}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="no-data">—</span>
                                    )}
                                </td>
                                <td className="arrow-cell">
                                    {comparison.skipped ? (
                                        <span className="skip-icon">⏸</span>
                                    ) : hasChanges(comparison) ? (
                                        <span className="change-arrow">→</span>
                                    ) : (
                                        <span className="no-change">=</span>
                                    )}
                                </td>
                                <td className="new-cell">
                                    {comparison.new && !comparison.skipped ? (
                                        <div className="credential-data">
                                            <div className="credential-field">
                                                <span className="field-label">Username:</span>
                                                <span className={`field-value ${comparison.changes.includes('username') ? 'changed' : ''}`}>
                                                    {comparison.new.username}
                                                </span>
                                            </div>
                                            <div className="credential-field">
                                                <span className="field-label">Password:</span>
                                                <span className={`field-value masked ${comparison.changes.includes('password') ? 'changed' : ''}`}>
                                                    {maskPassword(comparison.new.password)}
                                                </span>
                                            </div>
                                        </div>
                                    ) : comparison.skipped ? (
                                        <span className="skipped-text">Skipped</span>
                                    ) : (
                                        <span className="no-data">—</span>
                                    )}
                                </td>
                                <td className="status-cell">
                                    {comparison.skipped ? (
                                        <div className="status-badge skipped">
                                            <span className="lock-icon">🔒</span>
                                            <span className="status-text">Locked</span>
                                            <span className="skip-reason">{comparison.skipReason}</span>
                                        </div>
                                    ) : hasChanges(comparison) ? (
                                        <div className="status-badge changes">
                                            <span className="change-indicator">●</span>
                                            <span className="status-text">
                                                {comparison.changes.includes('new_system') ? 'New' : 
                                                 comparison.changes.includes('removed_system') ? 'Removed' :
                                                 comparison.changes.join(', ')}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="status-badge unchanged">
                                            <span className="status-text">Unchanged</span>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="comparison-legend">
                <div className="legend-item">
                    <span className="legend-color changed"></span>
                    <span className="legend-text">Changed values</span>
                </div>
                <div className="legend-item">
                    <span className="legend-icon">🔒</span>
                    <span className="legend-text">Locked (skipped)</span>
                </div>
                <div className="legend-item">
                    <span className="legend-color new"></span>
                    <span className="legend-text">New system</span>
                </div>
            </div>
        </div>
    );
};

export default CredentialComparison;
