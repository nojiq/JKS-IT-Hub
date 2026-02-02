import { useEffect, useRef } from 'react';
import './confirmation-dialog.css';

export const ConfirmationDialog = ({
    isOpen,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    onConfirm,
    onCancel,
    isDestructive = false
}) => {
    const dialogRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            dialogRef.current?.showModal();
        } else {
            dialogRef.current?.close();
        }
    }, [isOpen]);

    const handleConfirm = () => {
        onConfirm();
        onCancel(); // Close after confirm usually, or let parent handle
    };

    if (!isOpen) return null;

    return (
        <div className="dialog-overlay">
            <div className="dialog-content" role="dialog" aria-modal="true">
                <h3 className="dialog-title">{title}</h3>
                <p className="dialog-message">{message}</p>

                <div className="dialog-actions">
                    <button className="btn-secondary" onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    <button
                        className={`btn-primary ${isDestructive ? 'btn-danger' : ''}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
