import { useState } from 'react';
import { exportCredentials } from '../api/exports.js';

export function CredentialExportButton({ userId, username }) {
  const [isExporting, setIsExporting] = useState(false);
  const [notification, setNotification] = useState(null);

  const handleExport = async () => {
    setIsExporting(true);
    setNotification(null);

    try {
      await exportCredentials(userId);
      setNotification({
        type: 'success',
        message: 'Credentials exported successfully'
      });
    } catch (error) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to export credentials'
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="credential-export">
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="btn btn-secondary"
        title="Download credentials for secure delivery"
      >
        {isExporting ? 'Exporting...' : 'Export Credentials'}
      </button>
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
          <button
            className="notification-close"
            onClick={() => setNotification(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
