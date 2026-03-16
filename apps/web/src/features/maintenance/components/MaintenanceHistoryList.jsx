import React from 'react';
import './MaintenanceWindowList.css';
import DeviceTypeBadge from './DeviceTypeBadge.jsx';

const formatSignoffMode = (mode) => (mode === 'ASSISTED' ? 'Assisted' : 'Standard');

const MaintenanceHistoryList = ({ completions }) => {
    if (!completions || completions.length === 0) {
        return <div className="window-list-empty">No maintenance history found.</div>;
    }

    return (
        <div className="window-list-container">
            <table className="window-table">
                <thead>
                    <tr>
                        <th>Date Completed</th>
                        <th>Signed By</th>
                        <th>Sign-Off Mode</th>
                        <th>Signer</th>
                        <th>Signature</th>
                        <th>Cycle</th>
                        <th>Device Types</th>
                        <th>Checklist Snapshot</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {completions.map(record => {
                        const completionDeviceTypes = Array.isArray(record.deviceTypes) ? record.deviceTypes : [];
                        const windowDeviceTypes = Array.isArray(record.window?.deviceTypes) ? record.window.deviceTypes : [];
                        const deviceTypes = completionDeviceTypes.length > 0 ? completionDeviceTypes : windowDeviceTypes;
                        const signoffMode = record.signoffMode || 'STANDARD';
                        const hasSignature = Boolean(record.signerSignatureUrl);

                        return (
                            <tr key={record.id}>
                                <td>{new Date(record.completedAt).toLocaleString()}</td>
                                <td>{record.completedBy?.username || 'Unknown'}</td>
                                <td>{formatSignoffMode(signoffMode)}</td>
                                <td>{record.signerName || '-'}</td>
                                <td>
                                    {hasSignature ? (
                                        <a href={record.signerSignatureUrl} target="_blank" rel="noreferrer">
                                            View
                                        </a>
                                    ) : (
                                        '-'
                                    )}
                                </td>
                                <td>{record.window?.cycleConfig?.name || 'N/A'}</td>
                                <td>
                                    <DeviceTypeBadge deviceTypes={deviceTypes} showCount />
                                </td>
                                <td style={{ maxWidth: '260px' }}>
                                    {(record.checklistItems && record.checklistItems.length > 0) ? (
                                        <ul style={{ margin: 0, paddingInlineStart: '1rem' }}>
                                            {record.checklistItems.slice(0, 3).map((item) => (
                                                <li key={item.id}>
                                                    {item.isCompleted ? '✓' : '✗'} {item.itemTitle}
                                                </li>
                                            ))}
                                            {record.checklistItems.length > 3 && (
                                                <li>+{record.checklistItems.length - 3} more</li>
                                            )}
                                        </ul>
                                    ) : (
                                        record._count?.checklistItems || 0
                                    )}
                                </td>
                                <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {record.notes || '-'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default MaintenanceHistoryList;
