import { useState } from 'react';
import './CredentialList.css';

const CredentialList = ({ credentials, onViewHistory, onRegenerate, onOverride }) => {
    const [expandedId, setExpandedId] = useState(null);
    const [showPassword, setShowPassword] = useState({});

    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const togglePassword = (id) => {
        setShowPassword(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const maskPassword = (password) => {
        return '•'.repeat(Math.min(password?.length || 8, 12));
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    if (!credentials || credentials.length === 0) {
        return (
            <div className="credential-list-empty">
                <p>No credentials generated yet.</p>
                <p className="hint">Click "Generate Credentials" to create credentials for this user.</p>
            </div>
        );
    }

    return (
        <div className="credential-list">
            <h3>Generated Credentials</h3>
            <div className="credential-grid">
                {credentials.map((credential) => (
                    <div 
                        key={credential.id} 
                        className={`credential-card ${expandedId === credential.id ? 'expanded' : ''}`}
                    >
                        <div className="credential-header">
                            <div className="system-badge">{credential.system}</div>
                            <div className="credential-actions">
                                <button 
                                    className="btn-override"
                                    onClick={() => onOverride?.(credential)}
                                    title="Override Credential"
                                >
                                    Override
                                </button>
                                <button 
                                    className="btn-icon"
                                    onClick={() => toggleExpand(credential.id)}
                                    title="View Details"
                                >
                                    {expandedId === credential.id ? '▼' : '▶'}
                                </button>
                            </div>
                        </div>

                        <div className="credential-main">
                            <div className="credential-field">
                                <label>Username:</label>
                                <span className="username">{credential.username}</span>
                            </div>
                            <div className="credential-field">
                                <label>Password:</label>
                                <div className="password-display">
                                    <span className="password">
                                        {showPassword[credential.id] 
                                            ? credential.password 
                                            : maskPassword(credential.password)}
                                    </span>
                                    <button 
                                        className="btn-toggle"
                                        onClick={() => togglePassword(credential.id)}
                                    >
                                        {showPassword[credential.id] ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {expandedId === credential.id && (
                            <div className="credential-details">
                                <div className="detail-row">
                                    <span className="label">System:</span>
                                    <span>{credential.system}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Template Version:</span>
                                    <span>v{credential.templateVersion}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Generated At:</span>
                                    <span>{formatDate(credential.generatedAt)}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Status:</span>
                                    <span className={`status-badge ${credential.isActive ? 'active' : 'inactive'}`}>
                                        {credential.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="detail-actions">
                                    <button 
                                        className="btn-secondary"
                                        onClick={() => onViewHistory?.(credential.id)}
                                    >
                                        View History
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CredentialList;
