import { useState, useEffect } from 'react';
import { exportCredentials } from '../api/exports.js';
import { ExportPreview } from './ExportPreview.jsx';
import './credential-export.css';

const FORMAT_STORAGE_KEY = 'export-format-preference';

export function CredentialExportButton({ userId, username, credentials = [] }) {
  const [isExporting, setIsExporting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [format, setFormat] = useState('standard');

  // Load format preference from localStorage on mount
  useEffect(() => {
    const savedFormat = localStorage.getItem(FORMAT_STORAGE_KEY);
    if (savedFormat && (savedFormat === 'standard' || savedFormat === 'compressed')) {
      setFormat(savedFormat);
    }
  }, []);

  // Save format preference to localStorage when changed
  const handleFormatChange = (e) => {
    const newFormat = e.target.value;
    setFormat(newFormat);
    localStorage.setItem(FORMAT_STORAGE_KEY, newFormat);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setNotification(null);

    try {
      await exportCredentials(userId, format);
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
      <ExportPreview credentials={credentials} />
      <div className="export-controls">
        <select
          value={format}
          onChange={handleFormatChange}
          className="export-format-select"
          aria-label="Export format"
          disabled={isExporting}
        >
          <option value="standard">Standard (Human-readable)</option>
          <option value="compressed">Compressed (CSV-style)</option>
        </select>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="workspace-inline-button"
          type="button"
          title="Download credentials for secure delivery"
        >
          {isExporting ? 'Exporting...' : 'Export Credentials'}
        </button>
      </div>
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
