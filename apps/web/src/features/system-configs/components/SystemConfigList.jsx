const SystemConfigList = ({ configs = [], onEdit, onDelete, onCreate, showHeader = true }) => {
    return (
        <div className="system-config-list">
            {showHeader ? (
                <div className="section-header">
                    <div>
                        <h3>Systems</h3>
                        <p className="section-subtitle">Manage per-system username field mappings and access restrictions.</p>
                    </div>
                    {onCreate && (
                        <button className="btn btn-primary" onClick={onCreate}>
                            Add System
                        </button>
                    )}
                </div>
            ) : null}

            {configs.length === 0 ? (
                <div className="empty-state">
                    <p>No system configurations defined.</p>
                    <p className="hint">Credentials will use default 'mail' field mapping.</p>
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>System ID</th>
                                <th>LDAP Field</th>
                                <th>Access</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {configs.map((config) => (
                                <tr key={config.id}>
                                    <td>
                                        <div className="system-id-cell">
                                            <strong className="system-id-value">{config.systemId}</strong>
                                            {config.description && <p className="description-text">{config.description}</p>}
                                        </div>
                                    </td>
                                    <td>
                                        <code className="system-field-code">{config.usernameLdapField}</code>
                                    </td>
                                    <td>
                                        {config.isItOnly ? (
                                            <span className="badge badge-warning">IT Only</span>
                                        ) : (
                                            <span className="badge badge-info">Standard</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="row-actions">
                                            <button
                                                className="btn-link"
                                                type="button"
                                                onClick={() => onEdit(config)}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className="btn-link text-danger"
                                                type="button"
                                                onClick={() => onDelete(config.systemId)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SystemConfigList;
