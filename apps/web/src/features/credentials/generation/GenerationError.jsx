import './GenerationError.css';

const GenerationError = ({ error, onRetry }) => {
    if (!error) return null;

    const isMissingFieldsError = error.problemDetails?.missingFields?.length > 0;
    
    return (
        <div className="generation-error">
            <div className="error-header">
                <span className="error-icon">⚠️</span>
                <h3>Credential Generation Failed</h3>
            </div>
            
            <div className="error-content">
                <p className="error-message">{error.message}</p>
                
                {isMissingFieldsError && (
                    <div className="missing-fields-section">
                        <h4>Missing LDAP Fields:</h4>
                        <ul className="missing-fields-list">
                            {error.problemDetails.missingFields.map((field, index) => (
                                <li key={index} className="missing-field">
                                    <span className="field-name">{field}</span>
                                    <span className="field-hint">
                                        {getFieldHint(field)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <div className="remediation-guide">
                            <h5>How to resolve:</h5>
                            <ol>
                                <li>Update the user's LDAP record to include the missing fields</li>
                                <li>Run LDAP sync to pull the updated data</li>
                                <li>Retry credential generation</li>
                            </ol>
                        </div>
                    </div>
                )}
                
                {error.problemDetails?.system && (
                    <div className="system-context">
                        <strong>Affected System:</strong> {error.problemDetails.system}
                    </div>
                )}
            </div>
            
            <div className="error-actions">
                <button 
                    className="btn-retry"
                    onClick={onRetry}
                    disabled={isMissingFieldsError}
                >
                    Retry Generation
                </button>
                {isMissingFieldsError && (
                    <span className="retry-disabled-hint">
                        Fix LDAP data before retrying
                    </span>
                )}
            </div>
        </div>
    );
};

const getFieldHint = (field) => {
    const hints = {
        'mail': 'Email address (e.g., user@company.com)',
        'cn': 'Common Name (full name)',
        'givenName': 'First name',
        'sn': 'Last name (surname)',
        'telephoneNumber': 'Phone number',
        'department': 'Department/organization unit',
        'title': 'Job title',
        'employeeNumber': 'Employee ID number'
    };
    
    return hints[field] || 'LDAP attribute value';
};

export default GenerationError;
