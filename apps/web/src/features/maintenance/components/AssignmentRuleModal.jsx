import React, { useEffect } from 'react';
import AssignmentRuleForm from './AssignmentRuleForm.jsx';

/**
 * @param {{ isOpen: boolean, mode: 'create' | 'edit', rule?: object | null, onClose: () => void }} props
 */
const AssignmentRuleModal = ({ isOpen, mode, rule = null, onClose }) => {
    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const title = mode === 'create' ? 'New assignment rule' : 'Edit assignment rule';

    return (
        <div
            className="maintenance-window-detail-overlay"
            role="presentation"
            data-testid="assignment-rule-modal-overlay"
            onClick={onClose}
        >
            <div
                className="maintenance-window-detail-modal assignment-rule-modal-shell"
                role="dialog"
                aria-modal="true"
                aria-labelledby="assignment-rule-modal-title"
                data-testid="assignment-rule-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="maintenance-window-detail-header assignment-rule-modal__header">
                    <h2 id="assignment-rule-modal-title">{title}</h2>
                    <button type="button" className="workspace-inline-button" onClick={onClose} aria-label="Close dialog">
                        Close
                    </button>
                </header>
                <AssignmentRuleForm rule={mode === 'edit' ? rule : null} onClose={onClose} variant="modal" />
            </div>
        </div>
    );
};

export default AssignmentRuleModal;
