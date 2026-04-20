const PreviousImapPasswordsModal = ({ isOpen, entries = [], onClose, onRestore }) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div className="imap-generator-modal-backdrop" onClick={onClose}>
            <div
                aria-label="Previous IMAP Passwords"
                className="imap-generator-modal"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
            >
                <div className="imap-generator-modal-header">
                    <h2>Previous IMAP Passwords</h2>
                    <button onClick={onClose} type="button">Close</button>
                </div>
                <div className="imap-generator-modal-body">
                    {entries.map((entry) => (
                        <div className="imap-generator-modal-row" key={entry.id}>
                            <strong>{entry.username}</strong>
                            <span>{entry.metadata?.saveMode || "unknown"}</span>
                            <div className="imap-generator-modal-actions">
                                <button onClick={() => onRestore(entry.id, true)} type="button">
                                    Restore {entry.id} as active
                                </button>
                                <button onClick={() => onRestore(entry.id, false)} type="button">
                                    Restore {entry.id} as history only
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PreviousImapPasswordsModal;
