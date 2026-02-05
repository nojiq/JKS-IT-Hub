import CredentialHistoryCard from './CredentialHistoryCard.jsx';
import './CredentialHistory.css';

/**
 * CredentialHistoryList Component
 * 
 * Displays the list of credential history entries with pagination controls.
 * 
 * @param {Object} props
 * @param {Array} props.history - Array of history entries
 * @param {Object} props.pagination - Pagination state
 * @param {Function} props.onPageChange - Callback for page changes
 * @param {Array} props.selectedVersions - Currently selected versions for comparison
 * @param {Function} props.onVersionSelect - Callback when version is selected/deselected
 * @param {boolean} props.isFetching - Whether data is being fetched
 */
function CredentialHistoryList({
  history,
  pagination,
  onPageChange,
  selectedVersions,
  onVersionSelect,
  isFetching
}) {
  const { page, limit, total, totalPages } = pagination;

  const handlePrevious = () => {
    if (page > 1) {
      onPageChange(page - 1);
    }
  };

  const handleNext = () => {
    if (page < totalPages) {
      onPageChange(page + 1);
    }
  };

  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className={`history-list-container ${isFetching ? 'fetching' : ''}`}>
      <div className="history-list-header">
        <span className="results-info">
          Showing {startItem}–{endItem} of {total} entries
        </span>
        {isFetching && <span className="updating-indicator">Updating...</span>}
      </div>

      <div className="history-list">
        {history.map((entry) => (
          <CredentialHistoryCard
            key={entry.id}
            entry={entry}
            isSelected={selectedVersions.some(v => v.id === entry.id)}
            onSelect={() => onVersionSelect(entry)}
            canSelect={selectedVersions.length < 2 || selectedVersions.some(v => v.id === entry.id)}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            className="btn-pagination"
            onClick={handlePrevious}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            ← Previous
          </button>

          <div className="page-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                className={`btn-page ${pageNum === page ? 'active' : ''}`}
                onClick={() => onPageChange(pageNum)}
                aria-label={`Page ${pageNum}`}
                aria-current={pageNum === page ? 'page' : undefined}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            className="btn-pagination"
            onClick={handleNext}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export default CredentialHistoryList;
