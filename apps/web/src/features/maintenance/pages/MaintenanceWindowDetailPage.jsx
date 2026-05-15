import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useWindow, useMaintenanceCompletion } from '../hooks/useMaintenance.js';
import DeviceTypeBadge from '../components/DeviceTypeBadge.jsx';
import { formatDisplayDateTime } from '../../../shared/utils/date-format.js';
import { formatCycleLabel, formatWindowTitle } from '../utils/maintenanceDisplay.js';

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

    if (isLoading) {
        return <div className="maintenance-module-page maintenance-schedule-page">Loading maintenance window...</div>;
    }
    if (error) {
        return <div className="maintenance-module-page maintenance-schedule-page">Error loading maintenance window: {error.message}</div>;
    }
    if (!window) {
        return <div className="maintenance-module-page maintenance-schedule-page">Maintenance window not found.</div>;
    }

    const title = formatWindowTitle(window);
    const cycle = formatCycleLabel(window.cycleConfig?.name, 'Ad-hoc');
    const counts = toTypeCounts(window.deviceTypes);
    const typeEntries = Object.entries(counts);
    const checklist = resolveChecklist(window);

    return (
        <div className="maintenance-module-page maintenance-schedule-page">
            <header className="maintenance-page-header">
                <div>
                    <Link to="/maintenance/schedule" className="workspace-inline-link">Back to schedule</Link>
                    <h2>{title.primary}</h2>
                    {title.secondary ? <code>{title.secondary}</code> : null}
                </div>
                <span className={`maintenance-status-badge ${String(window.status).toLowerCase()}`}>{window.status}</span>
            </header>

            <dl className="maintenance-detail-grid">
                <div>
                    <dt>Cycle</dt>
                    <dd>{cycle.primary}</dd>
                </div>
                <div>
                    <dt>Scheduled start</dt>
                    <dd>{formatDisplayDateTime(window.scheduledStartDate, { fallback: '-' })}</dd>
                </div>
                <div>
                    <dt>Scheduled end</dt>
                    <dd>{formatDisplayDateTime(window.scheduledEndDate, { fallback: '-' })}</dd>
                </div>
                <div>
                    <dt>Device coverage</dt>
                    <dd>
                        <DeviceTypeBadge deviceTypes={window.deviceTypes} showCount />
                        {typeEntries.length > 0 ? (
                            <ul className="maintenance-detail-list">
                                {typeEntries.map(([type, count]) => (
                                    <li key={type}>{formatTypeLabel(type)}: {count}</li>
                                ))}
                            </ul>
                        ) : (
                            <span>No device types configured.</span>
                        )}
                    </dd>
                </div>
            </dl>

            <section className="maintenance-section">
                <header className="maintenance-section__header">
                    <h3>Checklist</h3>
                </header>
                {checklist ? (
                    <>
                        <p className="maintenance-muted">
                            <strong>{checklist.name || 'Checklist'}</strong>
                            {checklist.version ? ` (v${checklist.version})` : ''}
                        </p>
                        <ol className="maintenance-detail-list">
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
                    <p className="maintenance-muted">No checklist assigned.</p>
                )}
            </section>

            {window.status === 'COMPLETED' && completion ? (
                <section className="maintenance-section">
                    <header className="maintenance-section__header">
                        <h3>Completion details</h3>
                    </header>
                    <dl className="maintenance-detail-grid">
                        <div>
                            <dt>Signed off by</dt>
                            <dd>
                                {completion.completedBy?.username || 'Unknown'} at{' '}
                                {formatDisplayDateTime(completion.completedAt, { fallback: '-' })}
                            </dd>
                        </div>
                        <div>
                            <dt>Sign-off mode</dt>
                            <dd>{formatSignoffMode(completion.signoffMode)}</dd>
                        </div>
                        {completion.signerName ? (
                            <div>
                                <dt>Signer name</dt>
                                <dd>{completion.signerName}</dd>
                            </div>
                        ) : null}
                        {completion.notes ? (
                            <div>
                                <dt>Notes</dt>
                                <dd>{completion.notes}</dd>
                            </div>
                        ) : null}
                    </dl>
                    {completion.signerSignatureUrl ? (
                        <img
                            className="maintenance-detail-signature"
                            src={completion.signerSignatureUrl}
                            alt="Signer signature"
                        />
                    ) : null}
                </section>
            ) : null}
        </div>
    );
};

export default MaintenanceWindowDetailPage;
