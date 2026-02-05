import './CredentialHistory.css';

/**
 * HistoryEmptyState Component
 * 
 * Empty state component shown when no history entries are found.
 * 
 * @param {Object} props
 * @param {boolean} props.hasFilters - Whether filters are currently applied
 */
function HistoryEmptyState({ hasFilters }) {
  return (
    <div className="history-empty-state">
      <div className="empty-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 8v4"></path>
          <path d="M12 16h.01"></path>
        </svg>
      </div>
      
      <h3>No History Found</h3>
      
      {hasFilters ? (
        <>
          <p>
            No credential history entries match your current filters.
          </p>
          <p className="empty-hint">
            Try adjusting your filters or date range to see more results.
          </p>
        </>
      ) : (
        <>
          <p>
            No credential history is available for this user yet.
          </p>
          <p className="empty-hint">
            Credentials will appear here once they are generated or updated.
          </p>
        </>
      )}
    </div>
  );
}

export default HistoryEmptyState;
