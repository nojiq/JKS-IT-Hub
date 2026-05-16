import React, { useEffect } from 'react';
import ChecklistTemplateForm from './ChecklistTemplateForm.jsx';

/**
 * @param {{ isOpen: boolean, mode: 'create' | 'edit', templateId?: string | null, onClose: () => void }} props
 */
const ChecklistTemplateModal = ({ isOpen, mode, templateId = null, onClose }) => {
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

    const title = mode === 'create' ? 'New checklist template' : 'Edit checklist template';

    return (
        <div
            className="maintenance-window-detail-overlay"
            role="presentation"
            data-testid="checklist-template-modal-overlay"
            onClick={onClose}
        >
            <div
                className="maintenance-window-detail-modal checklist-template-modal-shell"
                role="dialog"
                aria-modal="true"
                aria-labelledby="checklist-template-modal-title"
                data-testid="checklist-template-modal"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="maintenance-window-detail-header checklist-template-modal__header">
                    <h2 id="checklist-template-modal-title">{title}</h2>
                    <button
                        type="button"
                        className="workspace-inline-button checklist-template-modal__close"
                        onClick={onClose}
                        aria-label="Close dialog"
                    >
                        Close
                    </button>
                </header>
                <ChecklistTemplateForm
                    templateId={mode === 'edit' ? templateId : null}
                    onClose={onClose}
                    variant="modal"
                />
            </div>
        </div>
    );
};

export default ChecklistTemplateModal;
