import { useState } from 'react';
import { useNormalizationPreview } from '../hooks/useNormalizationRules.js';

const NormalizationPreviewer = ({ systemId = null }) => {
    const [testValue, setTestValue] = useState('');
    const previewMutation = useNormalizationPreview();

    const handlePreview = () => {
        if (!testValue) return;
        previewMutation.mutate({ value: testValue, systemId });
    };

    return (
        <div className="normalization-previewer">
            <h4>Live Preview</h4>
            <p className="hint">Test how your rules will affect a raw username.</p>

            <div className="preview-input-group">
                <input
                    type="text"
                    className="form-control"
                    value={testValue}
                    onChange={(e) => setTestValue(e.target.value)}
                    placeholder="Enter test value (e.g. John.DOE@Example.com)"
                />
                <button
                    className="btn btn-secondary"
                    onClick={handlePreview}
                    disabled={!testValue || previewMutation.isPending}
                >
                    {previewMutation.isPending ? 'Testing...' : 'Test Rules'}
                </button>
            </div>

            {previewMutation.error && (
                <div className="preview-error">
                    <p>Error: {previewMutation.error.message}</p>
                </div>
            )}

            {previewMutation.data && (
                <div className="preview-results">
                    <div className="preview-row">
                        <span className="label">Original:</span>
                        <code>{previewMutation.data.data.original}</code>
                    </div>
                    <div className="preview-row">
                        <span className="label">Normalized:</span>
                        <code className="normalized-value">{previewMutation.data.data.normalized}</code>
                    </div>

                    {previewMutation.data.data.rulesApplied.length > 0 && (
                        <div className="applied-rules">
                            <span className="label">Applied Rules:</span>
                            <ul>
                                {previewMutation.data.data.rulesApplied.map((rule, idx) => (
                                    <li key={idx}>
                                        <span className="rule-badge">{rule.ruleType}</span>
                                        {rule.scope === 'global' ?
                                            <span className="scope-global">(Global)</span> :
                                            <span className="scope-system">(System)</span>
                                        }
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NormalizationPreviewer;
