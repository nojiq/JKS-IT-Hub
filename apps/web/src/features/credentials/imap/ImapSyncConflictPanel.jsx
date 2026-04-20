const ImapSyncConflictPanel = ({ conflicts = [], onUseLdap }) => {
    if (!conflicts.length) {
        return null;
    }

    return (
        <section className="imap-generator-panel">
            <h2>Sync Conflict Review</h2>
            <div className="imap-generator-conflict-list">
                {conflicts.map((conflict) => (
                    <div className="imap-generator-conflict-row" key={conflict.field}>
                        <strong>{conflict.field}</strong>
                        <span>{conflict.systemValue}</span>
                        <span>{conflict.ldapValue}</span>
                        <button onClick={() => onUseLdap(conflict.field)} type="button">
                            Use LDAP for {conflict.field}
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ImapSyncConflictPanel;
