import React, { useState, useEffect } from 'react';
import TemplatePreview from './TemplatePreview';
import { Link } from 'react-router-dom';

const DEFAULT_STRUCTURE = {
    systems: [],
    fields: [],
    normalizationRules: {}
};

export default function TemplateForm({ initialData = {}, onSubmit, isSubmitting }) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        isActive: true,
        structure: DEFAULT_STRUCTURE,
        ...initialData
    });

    const [systemsInput, setSystemsInput] = useState(initialData.structure?.systems?.join(', ') || '');

    useEffect(() => {
        const systems = systemsInput.split(',').map(s => s.trim()).filter(Boolean);
        setFormData(prev => ({
            ...prev,
            structure: { ...prev.structure, systems }
        }));
    }, [systemsInput]);

    const addField = () => {
        setFormData(prev => ({
            ...prev,
            structure: {
                ...prev.structure,
                fields: [
                    ...(prev.structure.fields || []),
                    { name: '', type: 'static', normalization: [] }
                ]
            }
        }));
    };

    const removeField = (index) => {
        setFormData(prev => ({
            ...prev,
            structure: {
                ...prev.structure,
                fields: prev.structure.fields.filter((_, i) => i !== index)
            }
        }));
    };

    const updateField = (index, key, value) => {
        setFormData(prev => {
            const newFields = [...(prev.structure.fields || [])];
            newFields[index] = { ...newFields[index], [key]: value };
            return {
                ...prev,
                structure: { ...prev.structure, fields: newFields }
            };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="editor-layout">
            <form className="form-pane" onSubmit={handleSubmit}>

                <div className="form-section">
                    <h3>Basic Information</h3>
                    <div className="form-group">
                        <label>Template Name</label>
                        <input
                            className="form-control"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                            placeholder="e.g. Standard Employee Credential"
                        />
                    </div>
                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            className="form-control"
                            value={formData.description || ''}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            placeholder="Describe what this template is used for..."
                        />
                    </div>
                    <div className="form-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                            />
                            Set as Active Template
                        </label>
                        <small className="text-muted" style={{ display: 'block', marginTop: '0.25rem', color: '#6b7280' }}>
                            Note: Activating this template will deactivate any other currently active template.
                        </small>
                    </div>
                </div>

                <div className="form-section">
                    <h3>Configuration</h3>
                    <div className="form-group">
                        <label>Target Systems (comma separated)</label>
                        <input
                            className="form-control"
                            value={systemsInput}
                            onChange={e => setSystemsInput(e.target.value)}
                            placeholder="e.g. email, vpn, jira"
                        />
                    </div>
                </div>

                <div className="form-section">
                    <div className="card-header">
                        <h3>Fields</h3>
                        <button type="button" onClick={addField} className="btn btn-secondary btn-sm">Add Field</button>
                    </div>

                    {formData.structure.fields?.length > 0 && (
                        <div className="field-list-header">
                            <span>Name</span>
                            <span>Source</span>
                            <span>Config</span>
                            <span>Options</span>
                            <span></span>
                        </div>
                    )}

                    {formData.structure.fields?.map((field, idx) => (
                        <div key={idx} className="field-row">
                            <input
                                className="form-control"
                                placeholder="Field Name"
                                value={field.name}
                                onChange={e => updateField(idx, 'name', e.target.value)}
                                required
                            />

                            <select
                                className="form-control"
                                value={field.type || 'static'}
                                onChange={e => updateField(idx, 'type', e.target.value)}
                            >
                                <option value="static">Static / Manual</option>
                                <option value="generated">Generated</option>
                                <option value="ldap">LDAP Attribute</option>
                            </select>

                            <div>
                                {field.type === 'generated' && (
                                    <input
                                        className="form-control"
                                        placeholder="Pattern"
                                        value={field.pattern || ''}
                                        onChange={e => updateField(idx, 'pattern', e.target.value)}
                                    />
                                )}
                                {field.type === 'ldap' && (
                                    <input
                                        className="form-control"
                                        placeholder="LDAP Attr"
                                        value={field.ldapSource || ''}
                                        onChange={e => updateField(idx, 'ldapSource', e.target.value)}
                                    />
                                )}
                            </div>

                            <div>
                                <label className="checkbox-label" style={{ marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={field.required}
                                        onChange={e => updateField(idx, 'required', e.target.checked)}
                                    /> Required
                                </label>
                            </div>

                            <button type="button" onClick={() => removeField(idx)} className="btn btn-danger btn-sm">×</button>
                        </div>
                    ))}

                    {(!formData.structure.fields || formData.structure.fields.length === 0) && (
                        <div className="text-center p-4 text-muted" style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                            No fields defined. Click "Add Field" to start.
                        </div>
                    )}
                </div>

                <div className="actions" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                        {isSubmitting ? 'Saving...' : 'Save Template'}
                    </button>
                    <Link to=".." className="btn btn-secondary">Cancel</Link>
                </div>
            </form>

            <div className="preview-pane">
                <TemplatePreview template={formData} />
            </div>
        </div>
    );
}
