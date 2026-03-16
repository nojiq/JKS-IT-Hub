import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useWindow, useMaintenanceCompletion } from '../hooks/useMaintenance.js';
import DeviceTypeBadge from '../components/DeviceTypeBadge.jsx';
import './MaintenanceSchedulePage.css';

const toTypeCounts = (deviceTypes = []) => {
    const normalized = deviceTypes
        .map((item) => (typeof item === 'string' ? item : item?.deviceType))
        .filter(Boolean);

    return normalized.reduce((acc, type) => {
        acc[type] = (acc[type] ?? 0) + 1;
        return acc;
    }, {});
};

const formatTypeLabel = (type) => {
    if (type === 'LAPTOP') return 'Laptop';
    if (type === 'DESKTOP_PC') return 'Desktop PC';
    if (type === 'SERVER') return 'Server';
    return type;
};

const formatSignoffMode = (mode) => (mode === 'ASSISTED' ? 'Assisted' : 'Standard');

const resolveChecklist = (window) => {
    const snapshot = window?.checklistSnapshot;
    if (snapshot?.items?.length) return snapshot;
    if (window?.checklist?.items?.length) {
        return {
            templateId: window.checklist.id,
            name: window.checklist.name,
            version: window.checklist.version,
            items: window.checklist.items
        };
    }
    return null;
};

const MaintenanceWindowDetailPage = () => {
    const { id } = useParams();
    const { data: window, isLoading, error } = useWindow(id);
    const completionId = window?.status === 'COMPLETED' ? id : null;
    const { data: completion } = useMaintenanceCompletion(completionId);

    if (isLoading) return <div className="maintenance-schedule-page">Loading maintenance window...</div>;
    if (error) return <div className="maintenance-schedule-page">Error loading maintenance window: {error.message}</div>;
    if (!window) return <div className="maintenance-schedule-page">Maintenance window not found.</div>;

    const counts = toTypeCounts(window.deviceTypes);
    const typeEntries = Object.entries(counts);
    const checklist = resolveChecklist(window);

    return (
        <div className="maintenance-schedule-page">
            <div style={{ marginBottom: '1rem' }}>
                <Link to="/maintenance/schedule" className="btn-secondary" style={{ textDecoration: 'none' }}>
                    Back to Schedule
                </Link>
            </div>

            <h1 style={{ marginBottom: '0.5rem' }}>{window.cycleConfig?.name || 'Maintenance Window'}</h1>
            <p style={{ marginBottom: '1.5rem', color: '#5f6368' }}>Window ID: {window.id}</p>

            <div style={{ display: 'grid', gap: '1rem' }}>
                <section>
                    <h2 style={{ marginBottom: '0.5rem' }}>Status</h2>
                    <span className={`status-badge ${window.status.toLowerCase()}`}>{window.status}</span>
                </section>

                <section>
                    <h2 style={{ marginBottom: '0.5rem' }}>Device Coverage</h2>
                    <DeviceTypeBadge deviceTypes={window.deviceTypes} showCount />
                    {typeEntries.length > 0 ? (
                        <ul style={{ marginTop: '0.5rem' }}>
                            {typeEntries.map(([type, count]) => (
                                <li key={type}>{formatTypeLabel(type)}: {count}</li>
                            ))}
                        </ul>
                    ) : (
                        <p>No device types configured.</p>
                    )}
                </section>

                <section>
                    <h2 style={{ marginBottom: '0.5rem' }}>Schedule</h2>
                    <p><strong>Start:</strong> {new Date(window.scheduledStartDate).toLocaleString()}</p>
                    <p><strong>End:</strong> {window.scheduledEndDate ? new Date(window.scheduledEndDate).toLocaleString() : '-'}</p>
                </section>

                <section>
                    <h2 style={{ marginBottom: '0.5rem' }}>Checklist</h2>
                    {checklist ? (
                        <>
                            <p>
                                <strong>{checklist.name || 'Checklist'} </strong>
                                {checklist.version ? `(v${checklist.version})` : ''}
                            </p>
                            <ol>
                                {[...checklist.items]
                                    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                                    .map((item, index) => (
                                        <li key={item.id || `${item.title}-${index}`}>
                                            <strong>{item.title}</strong> {item.isRequired ? '(Required)' : '(Optional)'}
                                            {item.description ? ` - ${item.description}` : ''}
                                        </li>
                                    ))}
                            </ol>
                        </>
                    ) : (
                        <p>No checklist assigned.</p>
                    )}
                </section>

                {window.status === 'COMPLETED' && completion && (
                    <section>
                        <h2 style={{ marginBottom: '0.5rem' }}>Completion Details</h2>
                        <p><strong>Status:</strong> <span className="status-badge completed">COMPLETED</span></p>
                        <p>
                            <strong>Signed Off By:</strong> {completion.completedBy?.username || 'Unknown'} at{' '}
                            {completion.completedAt ? new Date(completion.completedAt).toLocaleString() : '-'}
                        </p>
                        <p>
                            <strong>Sign-Off Mode:</strong> {formatSignoffMode(completion.signoffMode)}
                        </p>
                        {completion.signerName && (
                            <p><strong>Signer Name:</strong> {completion.signerName}</p>
                        )}
                        {completion.signerConfirmedAt && (
                            <p><strong>Signer Confirmed At:</strong> {new Date(completion.signerConfirmedAt).toLocaleString()}</p>
                        )}
                        {completion.signerSignatureUrl && (
                            <div style={{ marginBottom: '0.75rem' }}>
                                <strong>Signer Signature:</strong>
                                <div style={{ marginTop: '0.5rem' }}>
                                    <img
                                        src={completion.signerSignatureUrl}
                                        alt="Signer signature"
                                        style={{
                                            maxWidth: '320px',
                                            width: '100%',
                                            border: '1px solid #d0d7de',
                                            borderRadius: '8px',
                                            background: '#fff'
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                        <p><strong>Notes:</strong> {completion.notes || '-'}</p>
                        <div>
                            <strong>Checklist Snapshot:</strong>
                            {completion.checklistItems?.length ? (
                                <ul>
                                    {completion.checklistItems.map((item) => (
                                        <li key={item.id}>
                                            {item.isCompleted ? '✓' : '✗'} {item.itemTitle} {item.isRequired ? '(Required)' : '(Optional)'}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>No checklist snapshot available.</p>
                            )}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};

export default MaintenanceWindowDetailPage;
