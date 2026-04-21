const ImapUserResolver = ({
    attachedUserId,
    mode,
    onModeChange,
    manualIdentity,
    onManualIdentityChange,
    onResolverChange,
    onSelectSuggestion,
    resolverQuery,
    suggestions = []
}) => {
    const hasSuggestions = suggestions.length > 0;

    return (
        <section className="imap-generator-panel">
            <h2>User Resolver</h2>
            <label className="imap-generator-label" htmlFor="imap-user-resolver">
                Search by full name
            </label>
            <div className="imap-generator-resolver">
                <input
                    id="imap-user-resolver"
                    aria-autocomplete="list"
                    aria-controls={hasSuggestions ? "imap-user-suggestions" : undefined}
                    aria-expanded={hasSuggestions ? "true" : "false"}
                    className="imap-generator-input"
                    type="search"
                    placeholder="Find a user or start manual entry"
                    value={resolverQuery}
                    onChange={(event) => onResolverChange(event.target.value)}
                />
                {hasSuggestions ? (
                    <div
                        aria-label="User search suggestions"
                        className="imap-generator-suggestions"
                        id="imap-user-suggestions"
                        role="listbox"
                    >
                        {suggestions.map((suggestion) => (
                            <button
                                className="imap-generator-suggestion"
                                key={suggestion.id}
                                onClick={() => onSelectSuggestion(suggestion)}
                                type="button"
                            >
                                Use {suggestion.displayName}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
            <div className="imap-generator-mode-row">
                <button
                    aria-pressed={mode === "attached"}
                    className="imap-generator-chip"
                    onClick={() => onModeChange("attached")}
                    type="button"
                >
                    Attached User
                </button>
                <button
                    aria-pressed={mode === "manual"}
                    className="imap-generator-chip"
                    onClick={() => onModeChange("manual")}
                    type="button"
                >
                    Manual Entry
                </button>
            </div>
            {mode === "attached" && attachedUserId ? (
                <p className="imap-generator-helper">Attached user: {attachedUserId}</p>
            ) : null}
            {mode === "manual" ? (
                <div className="imap-generator-manual-panel">
                    <label className="imap-generator-label" htmlFor="imap-manual-full-name">
                        Manual Full Name
                    </label>
                    <input
                        id="imap-manual-full-name"
                        aria-label="Manual Full Name"
                        className="imap-generator-input"
                        type="text"
                        value={manualIdentity.fullName}
                        onChange={(event) => onManualIdentityChange("fullName", event.target.value)}
                    />
                    <label className="imap-generator-label" htmlFor="imap-manual-email">
                        Manual Email
                    </label>
                    <input
                        id="imap-manual-email"
                        aria-label="Manual Email"
                        className="imap-generator-input"
                        type="email"
                        value={manualIdentity.email}
                        onChange={(event) => onManualIdentityChange("email", event.target.value)}
                    />
                    <div className="imap-generator-panel imap-generator-create-user">
                        <h2>Create User</h2>
                        <p>Use these manual details to create and attach a new user if no directory match fits.</p>
                    </div>
                </div>
            ) : null}
        </section>
    );
};

export default ImapUserResolver;
