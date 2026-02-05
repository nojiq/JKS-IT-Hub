import { useMemo, useState } from 'react';
import { useLockedCredentials, useUnlockCredential } from '../hooks/useCredentials.js';
import './LockedCredentialsList.css';

const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
};

const LockedCredentialsList = () => {
    const [filters, setFilters] = useState({
        userQuery: '',
        systemId: '',
        startDate: '',
        endDate: ''
    });
    const [notification, setNotification] = useState(null);

    const lockedQuery = useLockedCredentials({
        systemId: filters.systemId || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined
    });
    const unlockMutation = useUnlockCredential();

    const filteredData = useMemo(() => {
        const items = lockedQuery.data?.data || [];
        if (!filters.userQuery) return items;
        const query = filters.userQuery.toLowerCase();
        return items.filter((item) =>
            item.userName?.toLowerCase().includes(query) ||
            item.userEmail?.toLowerCase().includes(query) ||
            item.userId?.toLowerCase().includes(query)
        );
    }, [lockedQuery.data, filters.userQuery]);

    const handleUnlock = async (item) => {
        setNotification(null);
        try {
            await unlockMutation.mutateAsync({ userId: item.userId, systemId: item.systemId });
            setNotification({ type: 'success', message: 'Credential unlocked.' });
        } catch (error) {
            setNotification({
                type: 'error',
                message: error.problemDetails?.detail || error.message || 'Failed to unlock credential'
            });
        }
    };

    if (lockedQuery.isLoading) {
        return <p className="locked-credentials-loading">Loading locked credentials…</p>;
    }

    if (lockedQuery.error) {
        return <p className="locked-credentials-error">Unable to load locked credentials.</p>;
    }

    return (
        <div className="locked-credentials">
            <div className="locked-credentials-header">
                <h2>Locked Credentials</h2>
                <p>Manage and unlock credentials that are currently protected.</p>
            </div>

            <div className="locked-credentials-filters">
                <input
                    type="text"
                    placeholder="Filter by user"
                    value={filters.userQuery}
                    onChange={(event) => setFilters({ ...filters, userQuery: event.target.value })}
                />
                <input
                    type="text"
                    placeholder="Filter by system ID"
                    value={filters.systemId}
                    onChange={(event) => setFilters({ ...filters, systemId: event.target.value })}
                />
                <input
                    type="date"
                    value={filters.startDate}
                    onChange={(event) => setFilters({ ...filters, startDate: event.target.value })}
                />
                <input
                    type="date"
                    value={filters.endDate}
                    onChange={(event) => setFilters({ ...filters, endDate: event.target.value })}
                />
            </div>

            {notification && (
                <div className={`notification notification-${notification.type}`}>
                    {notification.message}
                    <button className="notification-close" onClick={() => setNotification(null)}>
                        ×
                    </button>
                </div>
            )}

            {filteredData.length === 0 ? (
                <div className="locked-credentials-empty">
                    <p>No locked credentials found.</p>
                </div>
            ) : (
                <div className="locked-credentials-table">
                    <div className="locked-credentials-row locked-credentials-row--header">
                        <span>User</span>
                        <span>System</span>
                        <span>Locked By</span>
                        <span>Locked At</span>
                        <span>Reason</span>
                        <span></span>
                    </div>
                    {filteredData.map((item) => (
                        <div key={`${item.userId}-${item.systemId}`} className="locked-credentials-row">
                            <span>
                                <strong>{item.userName || item.userId}</strong>
                                {item.userEmail && <span className="muted"> {item.userEmail}</span>}
                            </span>
                            <span>{item.systemName || item.systemId}</span>
                            <span>{item.lockedByName || item.lockedBy || '—'}</span>
                            <span>{formatDate(item.lockedAt)}</span>
                            <span>{item.lockReason || '—'}</span>
                            <span>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => handleUnlock(item)}
                                    disabled={unlockMutation.isPending}
                                >
                                    Unlock
                                </button>
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LockedCredentialsList;
