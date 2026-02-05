import './UnlockCredentialModal.css';

const UnlockCredentialModal = ({
    isOpen,
    credential,
    userName,
    onConfirm,
    onClose,
    isLoading,
    error
}) => {
    if (!isOpen || !credential) return null;

    const systemLabel = credential.systemName || credential.systemId || credential.system;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content unlock-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                    <h2>Unlock Credential</h2>
                    <button className="btn-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <p className="unlock-message">
                        This will allow the credential to be regenerated again.
                    </p>

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

                    {error && (
                        <div className="error-message">
                            {error.problemDetails?.detail || error.message || 'Failed to unlock credential'}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" onClick={onConfirm} disabled={isLoading}>
                        {isLoading ? 'Unlocking...' : 'Unlock Credential'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UnlockCredentialModal;
