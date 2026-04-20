const ImapUserResolver = () => {
    return (
        <section className="imap-generator-panel">
            <h2>User Resolver</h2>
            <label className="imap-generator-label" htmlFor="imap-user-resolver">
                Search by full name
            </label>
            <input
                id="imap-user-resolver"
                className="imap-generator-input"
                type="search"
                placeholder="Find a user or start manual entry"
            />
            <div className="imap-generator-mode-row">
                <button className="imap-generator-chip" type="button">Attached User</button>
                <button className="imap-generator-chip" type="button">Manual Entry</button>
            </div>
        </section>
    );
};

export default ImapUserResolver;
