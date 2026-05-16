import React, { useEffect } from 'react';
import './CycleConfigForm.css';

/**
 * Small centered confirm overlay (matches maintenance modal overlay tokens).
 *
 * @param {{
 *   open: boolean,
 *   title: string,
 *   children?: React.ReactNode,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   onConfirm: () => void | Promise<void>,
 *   onClose: () => void,
 *   isPending?: boolean,
 *   confirmVariant?: 'danger' | 'primary'
 * }} props
 */
export function MaintenanceConfirmDialog({
    open,
    title,
    children,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onClose,
    isPending = false,
    confirmVariant = 'danger'
}) {
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (!isPending) onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, isPending, onClose]);

    if (!open) return null;

    const confirmClass =
        confirmVariant === 'danger'
            ? 'workspace-inline-button cycle-config-form__btn-danger'
            : 'workspace-inline-button is-primary';

    return (
        <div className="maintenance-window-detail-overlay" role="presentation" onClick={() => !isPending && onClose()}>
            <div
                className="maintenance-window-detail-modal maintenance-confirm-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="maintenance-confirm-title"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id="maintenance-confirm-title" className="maintenance-confirm-dialog__title">
                    {title}
                </h2>
                {children ? <div className="maintenance-confirm-dialog__body">{children}</div> : null}
                <div className="maintenance-window-detail-actions maintenance-confirm-dialog__actions">
                    <button type="button" className="workspace-inline-button" onClick={onClose} disabled={isPending}>
                        {cancelLabel}
                    </button>
                    <button type="button" className={confirmClass} onClick={onConfirm} disabled={isPending}>
                        {isPending ? 'Please wait…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
