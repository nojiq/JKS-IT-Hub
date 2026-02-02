import React, { useMemo } from 'react';

export default function TemplatePreview({ template }) {
    const previewData = useMemo(() => {
        if (!template?.structure?.fields) return {};

        const creds = {};
        template.structure.fields.forEach(field => {
            let value = "Sample Value";
            if (field.type === 'generated') {
                value = `Gen_${field.pattern || 'Pattern'}_123`;
            } else if (field.ldapSource) {
                value = `John.Doe`;
            }

            if (field.normalization?.includes('lowercase')) value = value.toLowerCase();
            if (field.normalization?.includes('uppercase')) value = value.toUpperCase();
            if (field.normalization?.includes('trim')) value = value.trim();
            if (field.normalization?.includes('removeSpaces')) value = value.replace(/\s+/g, '');

            creds[field.name] = value;
        });
        return creds;
    }, [template]);

    return (
        <div className="preview-card">
            <h3>Live Preview</h3>
            <div className="preview-box">
                <pre>{JSON.stringify(previewData, null, 2)}</pre>
            </div>
            <div className="preview-meta">
                <h4>Target Systems</h4>
                <div className="tags">
                    {template.structure?.systems?.map(s => (
                        <span key={s} className="tag">{s}</span>
                    ))}
                    {(!template.structure?.systems || template.structure.systems.length === 0) && (
                        <span className="text-muted">No systems selected</span>
                    )}
                </div>
            </div>
        </div>
    );
}
