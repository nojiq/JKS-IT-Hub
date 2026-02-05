import { useEffect, useState } from 'react';
import './LockCredentialModal.css';

const MAX_REASON_LENGTH = 255;

const LockCredentialModal = ({
    isOpen,
    credential,
    userName,
    onConfirm,
    onClose,
    isLoading,
    error
}) => {
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (isOpen) {
            setReason('');
        }
    }, [isOpen, credential?.id]);

    if (!isOpen || !credential) return null;

    const handleSubmit = () => {
        if (isLoading) return;
        onConfirm?.(reason.trim());
    };

    const systemLabel = credential.systemName || credential.systemId || credential.system;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content lock-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                    <h2>Lock Credential</h2>
                    <button className="btn-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <div className="lock-summary">
                        <div className="summary-row">
                            <span className="summary-label">User</span>
                            <span className="summary-value">{userName || credential.userName || credential.userId}</span>
                        </div>
                        <div className="summary-row">
                            <span className="summary-label">System</span>
                            <span className="summary-value">{systemLabel}</span>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="lock-reason">Lock Reason (Optional)</label>
                        <textarea
                            id="lock-reason"
                            className="form-textarea"
                            rows={3}
                            maxLength={MAX_REASON_LENGTH}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Add a reason for locking this credential (optional)"
                        />
                        <small className="char-count">
                            {reason.length} / {MAX_REASON_LENGTH}
                        </small>
                    </div>

                    <div className="lock-warning">
                        <strong>Warning:</strong> Locked credentials cannot be regenerated until they are unlocked.
                    </div>

                    {error && (
                        <div className="error-message">
                            {error.problemDetails?.detail || error.message || 'Failed to lock credential'}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={isLoading}>
                        {isLoading ? 'Locking...' : 'Lock Credential'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LockCredentialModal;
