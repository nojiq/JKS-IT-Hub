import { useState, useEffect } from 'react';

const DEFAULT_FORM_DATA = {
    systemId: '',
    usernameLdapField: '',
    description: '',
    isItOnly: false
};

const SystemConfigForm = ({ initialData = null, onSubmit, onCancel, isSubmitting, availableFields = [] }) => {
    const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
    const isEditing = !!initialData;

    useEffect(() => {
        if (initialData) {
            setFormData({
                systemId: initialData.systemId || '',
                usernameLdapField: initialData.usernameLdapField || '',
                description: initialData.description || '',
                isItOnly: initialData.isItOnly || false
            });
        }
    }, [initialData]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="system-config-form">
            <div className="form-header">
                <h3>{isEditing ? `Edit System: ${formData.systemId}` : 'Add New System Configuration'}</h3>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="systemId">System ID *</label>
                    <input
                        id="systemId"
                        name="systemId"
                        type="text"
                        className="form-control"
                        value={formData.systemId}
                        onChange={handleChange}
                        disabled={isEditing}
                        placeholder="e.g. corporate-vpn"
                        required
                        pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
                        title="Must be kebab-case (lowercase, numbers, and hyphens)"
                    />
                    {!isEditing && <p className="form-hint">Unique identifier used for mapping. Must be kebab-case.</p>}
                </div>

                <div className="form-group">
                    <label htmlFor="usernameLdapField">Username LDAP Field *</label>
                    <select
                        id="usernameLdapField"
                        name="usernameLdapField"
                        className="form-control"
                        value={formData.usernameLdapField}
                        onChange={handleChange}
                        required
                    >
                        <option value="">Select LDAP field...</option>
                        {availableFields.map(field => (
                            <option key={field} value={field}>{field}</option>
                        ))}
                    </select>
                    <p className="form-hint">The LDAP attribute to use as the source for username generation.</p>
                </div>

                <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea
                        id="description"
                        name="description"
                        className="form-control"
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Purpose of this system configuration..."
                        rows="2"
                    />
                </div>

                <div className="form-group">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            name="isItOnly"
                            checked={formData.isItOnly}
                            onChange={handleChange}
                        />
                        IT-Only Access
                    </label>
                    {formData.isItOnly && (
                        <p className="form-hint warning">
                            ⚠️ This system's credentials will only be visible to IT staff and excluded from common exports.
                        </p>
                    )}
                </div>

                <div className="form-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onCancel}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isSubmitting || !formData.systemId || !formData.usernameLdapField}
                    >
                        {isSubmitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create System')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SystemConfigForm;
