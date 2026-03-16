import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCredentialHistory } from '../hooks/useCredentials.js';
import CredentialHistoryList from './CredentialHistoryList.jsx';
import CredentialFilters from './CredentialFilters.jsx';
import CredentialComparison from './CredentialComparison.jsx';
import HistoryEmptyState from './HistoryEmptyState.jsx';
import './CredentialHistory.css';

/**
 * CredentialHistory Component
 * 
 * Main page component for credential history with filters and pagination.
 * Displays all historical credential versions with filtering capabilities.
 * 
 * Features:
 * - Filter by system type
 * - Date range filtering
 * - Pagination controls
 * - Version comparison selection
 * - Color-coded reason badges
 * 
 * @param {Object} props
 * @param {string} props.userId - User ID to fetch history for
 */
function CredentialHistory({ userId }) {
  const { userId: routeUserId } = useParams();
  const resolvedUserId = userId ?? routeUserId;

  const [filters, setFilters] = useState({
    system: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 10
  });
  
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  
  const { data, isLoading, error, isFetching } = useCredentialHistory(resolvedUserId, filters);
  const history = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 10, total: 0, totalPages: 0 };
  const systems = useMemo(
    () => [...new Set(history.map((entry) => entry.system).filter(Boolean))].sort(),
    [history]
  );

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1 // Reset to first page on filter change
    }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }));
  };

  const handleVersionSelect = (version) => {
    setSelectedVersions(prev => {
      const exists = prev.find(v => v.id === version.id);
      if (exists) {
        return prev.filter(v => v.id !== version.id);
      }
      if (prev.length >= 2) {
        // Replace oldest selection
        return [...prev.slice(1), version];
      }
      return [...prev, version];
    });
  };

  const handleClearSelection = () => {
    setSelectedVersions([]);
    setShowComparison(false);
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2) {
      setShowComparison(true);
    }
  };

  const handleCloseComparison = () => {
    setShowComparison(false);
  };

  if (isLoading) {
    return (
      <div className="credential-history">
        <div className="history-loading">
          <div className="loading-spinner"></div>
          <p>Loading credential history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="credential-history">
        <div className="history-error">
          <h3>Error loading history</h3>
          <p>{error.message || 'Failed to load credential history'}</p>
          {error.problemDetails?.detail && (
            <p className="error-detail">{error.problemDetails.detail}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="credential-history">
      <header className="history-header">
        <h2>Credential History</h2>
        <p className="history-subtitle">
          View and compare historical credential versions
        </p>
      </header>

      <CredentialFilters
        filters={filters}
        systems={systems}
        onFilterChange={handleFilterChange}
        selectedCount={selectedVersions.length}
        onClearSelection={handleClearSelection}
        onCompare={handleCompare}
        canCompare={selectedVersions.length === 2}
      />

      {showComparison && selectedVersions.length === 2 && (
        <div className="comparison-modal">
          <div className="comparison-modal-content">
            <CredentialComparison
              versionId1={selectedVersions[0].id}
              versionId2={selectedVersions[1].id}
              onClose={handleCloseComparison}
            />
          </div>
        </div>
      )}

      {history.length === 0 ? (
        <HistoryEmptyState hasFilters={filters.system || filters.startDate || filters.endDate} />
      ) : (
        <CredentialHistoryList
          history={history}
          pagination={pagination}
          onPageChange={handlePageChange}
          selectedVersions={selectedVersions}
          onVersionSelect={handleVersionSelect}
          isFetching={isFetching}
        />
      )}
    </div>
  );
}

export default CredentialHistory;
