import { useEffect, useState } from 'react';
import './RegenerationBlockedModal.css';

const RegenerationBlockedModal = ({
    isOpen,
    lockedCredentials = [],
    onCancel,
    onSkipLocked,
    onUnlockSelected,
    isProcessing,
    error
}) => {
    const [selected, setSelected] = useState(new Set());

    useEffect(() => {
        if (isOpen) {
            setSelected(new Set());
        }
    }, [isOpen, lockedCredentials.length]);

    if (!isOpen) return null;

    const toggleSelection = (systemId) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(systemId)) {
                next.delete(systemId);
            } else {
                next.add(systemId);
            }
            return next;
        });
    };

    const handleUnlockSelected = () => {
        const selectedItems = lockedCredentials.filter((item) =>
            selected.has(item.systemId)
        );
        onUnlockSelected?.(selectedItems);
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content regeneration-blocked-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                    <h2>Credentials Locked</h2>
                    <button className="btn-close" onClick={onCancel}>×</button>
                </div>

                <div className="modal-body">
                    <p className="blocked-intro">
                        The following credentials are locked and cannot be regenerated.
                    </p>

                    <div className="locked-list">
                        {lockedCredentials.map((item) => (
                            <label key={item.systemId} className="locked-item">
                                <input
                                    type="checkbox"
                                    checked={selected.has(item.systemId)}
                                    onChange={() => toggleSelection(item.systemId)}
                                    disabled={isProcessing}
                                />
                                <div className="locked-item-details">
                                    <div className="locked-item-title">
                                        <span className="lock-icon">🔒</span>
                                        <span>{item.systemName || item.systemId}</span>
                                    </div>
                                    <div className="locked-item-meta">
                                        <span>Locked by {item.lockedBy || item.lockedByName || 'Unknown'}</span>
                                        {item.lockedAt && <span>on {new Date(item.lockedAt).toLocaleString()}</span>}
                                    </div>
                                    {item.lockReason && (
                                        <div className="locked-item-reason">
                                            Reason: {item.lockReason}
                                        </div>
                                    )}
                                </div>
                            </label>
                        ))}
                    </div>

                    {error && (
                        <div className="error-message">
                            {error.problemDetails?.detail || error.message || 'Failed to process locked credentials'}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onCancel} disabled={isProcessing}>
                        Cancel
                    </button>
                    <button className="btn btn-secondary" onClick={onSkipLocked} disabled={isProcessing}>
                        Skip Locked
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleUnlockSelected}
                        disabled={isProcessing || selected.size === 0}
                    >
                        {isProcessing ? 'Unlocking...' : 'Unlock Selected'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RegenerationBlockedModal;
