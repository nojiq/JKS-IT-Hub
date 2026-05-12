import { useState, useEffect } from 'react';
import { exportBatchCredentials } from '../api/exports.js';
import './credential-export.css';

const FORMAT_STORAGE_KEY = 'export-format-preference';

export function BatchCredentialExportButton({ userIds }) {
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
        try {
            if (!userIds || userIds.length === 0) {
                throw new Error('No users selected for export');
            }

            if (userIds.length > 100) {
                throw new Error(`Batch export limited to 100 users. You selected ${userIds.length}. Please split into smaller batches.`);
            }

            setIsExporting(true);
            setNotification(null);

            const result = await exportBatchCredentials(userIds, format);
            const successfulExports = Number.isFinite(result?.successfulExports) ? result.successfulExports : userIds.length;
            const skippedUsers = Number.isFinite(result?.skippedUsers) ? result.skippedUsers : 0;
            const totalUsers = Number.isFinite(result?.totalUsers) ? result.totalUsers : userIds.length;

            setNotification({
                type: 'success',
                message: `Batch export complete: ${successfulExports}/${totalUsers} exported, ${skippedUsers} skipped`
            });

            // Clear notification after 5 seconds
            setTimeout(() => setNotification(null), 5000);
        } catch (error) {
            setNotification({
                type: 'error',
                message: error.message || 'Failed to export batch credentials'
            });
        } finally {
            setIsExporting(false);
        }
    };

    const isDisabled = isExporting || !userIds || userIds.length === 0;

    return (
        <div className="credential-export batch-export">
            <p className="export-preview-message">
                IMAP credentials are excluded from exports for security.
            </p>
            <div className="export-controls">
                <select
                    value={format}
                    onChange={handleFormatChange}
                    className="export-format-select"
                    aria-label="Export format"
                    disabled={isDisabled}
                >
                    <option value="standard">Standard (Human-readable)</option>
                    <option value="compressed">Compressed (CSV-style)</option>
                </select>
                <button
                    onClick={handleExport}
                    disabled={isDisabled}
                    className="workspace-inline-button"
                    type="button"
                    title="Download credentials for selected users"
                >
                    {isExporting ? 'Exporting Batch...' : 'Export Selected Credentials'}
                </button>
            </div>

            {notification && (
                <div className={`notification notification-${notification.type} mt-2 p-2 rounded text-sm ${notification.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`} role="alert">
                    <div className="flex justify-between items-center">
                        <span>{notification.message}</span>
                        <button
                            className="notification-close ml-2 text-lg font-bold"
                            onClick={() => setNotification(null)}
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
