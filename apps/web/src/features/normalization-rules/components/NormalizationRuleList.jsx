import { useState } from 'react';

const RULE_TYPE_LABELS = {
    lowercase: 'Lowercase',
    uppercase: 'Uppercase',
    trim: 'Trim Whitespace',
    remove_spaces: 'Remove All Spaces',
    remove_special: 'Remove Special Characters',
    truncate: 'Truncate Length',
    regex: 'Regex Replace'
};

const NormalizationRuleList = ({ rules = [], onEdit, onDelete, onReorder, systemId = null }) => {
    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

    const handleMove = (index, direction) => {
        const newRules = [...sortedRules];
        const targetIndex = index + direction;

        if (targetIndex < 0 || targetIndex >= newRules.length) return;

        [newRules[index], newRules[targetIndex]] = [newRules[targetIndex], newRules[index]];

        onReorder(newRules.map(r => r.id));
    };

    return (
        <div className="normalization-rule-list">
            <div className="list-header">
                <h4>{systemId ? `Rules for ${systemId}` : 'Global Normalization Rules'}</h4>
                {!systemId && <p className="hint">Global rules are applied to ALL systems before system-specific rules.</p>}
            </div>

            {sortedRules.length === 0 ? (
                <div className="empty-state small">
                    <p>No rules defined for this scope.</p>
                </div>
            ) : (
                <div className="rules-container">
                    {sortedRules.map((rule, index) => (
                        <div key={rule.id} className={`rule-item ${!rule.isActive ? 'disabled' : ''}`}>
                            <div className="rule-priority-actions">
                                <button
                                    className="btn-move"
                                    onClick={() => handleMove(index, -1)}
                                    disabled={index === 0}
                                    title="Move Up"
                                >
                                    ↑
                                </button>
                                <button
                                    className="btn-move"
                                    onClick={() => handleMove(index, 1)}
                                    disabled={index === sortedRules.length - 1}
                                    title="Move Down"
                                >
                                    ↓
                                </button>
                            </div>

                            <div className="rule-info">
                                <div className="rule-type">
                                    <strong>{RULE_TYPE_LABELS[rule.ruleType] || rule.ruleType}</strong>
                                    {!rule.isActive && <span className="badge badge-secondary">Inactive</span>}
                                </div>
                                <div className="rule-config-summary">
                                    {rule.ruleType === 'truncate' && rule.ruleConfig.maxLength && (
                                        <span>Length: {rule.ruleConfig.maxLength}</span>
                                    )}
                                    {rule.ruleType === 'regex' && rule.ruleConfig.pattern && (
                                        <code>{rule.ruleConfig.pattern} → {rule.ruleConfig.replacement || "''"}</code>
                                    )}
                                </div>
                            </div>

                            <div className="rule-actions">
                                <button className="btn-link" onClick={() => onEdit(rule)}>Edit</button>
                                <button className="btn-link text-danger" onClick={() => onDelete(rule.id)}>Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NormalizationRuleList;
