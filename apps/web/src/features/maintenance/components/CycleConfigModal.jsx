import React, { useEffect } from 'react';
import CycleConfigForm from './CycleConfigForm.jsx';

/**
 * @param {{ isOpen: boolean, mode: 'create' | 'edit', cycle?: object | null, onClose: () => void }} props
 */
const CycleConfigModal = ({ isOpen, mode, cycle = null, onClose }) => {
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

    const title = mode === 'create' ? 'New maintenance policy' : 'Edit maintenance policy';

    return (
        <div
            className="maintenance-window-detail-overlay"
            role="presentation"
            data-testid="cycle-config-modal-overlay"
            onClick={onClose}
        >
            <div
                className="maintenance-window-detail-modal cycle-config-modal-shell"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cycle-config-modal-title"
                data-testid="cycle-config-modal"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="maintenance-window-detail-header cycle-config-modal__header">
                    <h2 id="cycle-config-modal-title">{title}</h2>
                    <button
                        type="button"
                        className="workspace-inline-button cycle-config-modal__close"
                        onClick={onClose}
                        aria-label="Close dialog"
                    >
                        Close
                    </button>
                </header>
                <CycleConfigForm
                    cycle={mode === 'edit' ? cycle : null}
                    onClose={onClose}
                    variant="modal"
                />
            </div>
        </div>
    );
};

export default CycleConfigModal;
