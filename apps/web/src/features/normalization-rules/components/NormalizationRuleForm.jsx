import { useState, useEffect } from 'react';

const RULE_TYPES = [
    { value: 'lowercase', label: 'Lowercase' },
    { value: 'uppercase', label: 'Uppercase' },
    { value: 'trim', label: 'Trim Whitespace' },
    { value: 'remove_spaces', label: 'Remove All Spaces' },
    { value: 'remove_special', label: 'Remove Special Characters' },
    { value: 'truncate', label: 'Truncate Length' },
    { value: 'regex', label: 'Regex Replace' }
];

const DEFAULT_FORM_DATA = {
    ruleType: 'lowercase',
    ruleConfig: {},
    isActive: true,
    priority: 0
};

const NormalizationRuleForm = ({ initialData = null, onSubmit, onCancel, isSubmitting, systemId = null }) => {
    const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
    const isEditing = !!initialData;

    useEffect(() => {
        if (initialData) {
            setFormData({
                ruleType: initialData.ruleType || 'lowercase',
                ruleConfig: initialData.ruleConfig || {},
                isActive: initialData.isActive ?? true,
                priority: initialData.priority || 0
            });
        }
    }, [initialData]);

    const handleTypeChange = (e) => {
        const type = e.target.value;
        setFormData(prev => ({
            ...prev,
            ruleType: type,
            ruleConfig: type === 'truncate' ? { maxLength: 20 } : (type === 'regex' ? { pattern: '', replacement: '' } : {})
        }));
    };

    const handleConfigChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            ruleConfig: {
                ...prev.ruleConfig,
                [name]: name === 'maxLength' ? parseInt(value, 10) : value
            }
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            ...formData,
            systemId: systemId // Ensure it's for the current scope
        });
    };

    return (
        <form className="normalization-rule-form" onSubmit={handleSubmit}>
            <div className="form-group">
                <label>Rule Type</label>
                <select
                    className="form-control"
                    value={formData.ruleType}
                    onChange={handleTypeChange}
                    disabled={isEditing}
                >
                    {RULE_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                </select>
            </div>

            {formData.ruleType === 'truncate' && (
                <div className="form-group">
                    <label>Maximum Length</label>
                    <input
                        type="number"
                        name="maxLength"
                        className="form-control"
                        value={formData.ruleConfig.maxLength || ''}
                        onChange={handleConfigChange}
                        min="1"
                        required
                    />
                </div>
            )}

            {formData.ruleType === 'regex' && (
                <>
                    <div className="form-group">
                        <label>Regex Pattern</label>
                        <input
                            type="text"
                            name="pattern"
                            className="form-control"
                            value={formData.ruleConfig.pattern || ''}
                            onChange={handleConfigChange}
                            placeholder="e.g. [^a-z0-9]"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Replacement String</label>
                        <input
                            type="text"
                            name="replacement"
                            className="form-control"
                            value={formData.ruleConfig.replacement || ''}
                            onChange={handleConfigChange}
                            placeholder="e.g. _"
                        />
                    </div>
                </>
            )}

            <div className="form-group">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    />
                    Active Rule
                </label>
            </div>

            <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : (isEditing ? 'Update Rule' : 'Add Rule')}
                </button>
            </div>
        </form>
    );
};

export default NormalizationRuleForm;
