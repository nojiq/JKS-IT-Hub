import { useMemo, useState } from 'react';
import { useLockCredential, useUnlockCredential, useUserLockedCredentials } from '../hooks/useCredentials.js';
import LockCredentialModal from './LockCredentialModal.jsx';
import UnlockCredentialModal from './UnlockCredentialModal.jsx';
import { ItOnlyBadge } from './ItOnlyBadge.jsx';
import './CredentialList.css';

const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
};

const CredentialList = ({ credentials, userId, userName, userEmail, canManageLocks }) => {
    const [activeCredential, setActiveCredential] = useState(null);
    const [modalType, setModalType] = useState(null);
    const [expandedLock, setExpandedLock] = useState(null);
    const [notification, setNotification] = useState(null);

    const lockedQuery = useUserLockedCredentials(canManageLocks ? userId : null);
    const lockMutation = useLockCredential();
    const unlockMutation = useUnlockCredential();

    const lockedMap = useMemo(() => {
        const entries = lockedQuery.data?.data || [];
        return new Map(entries.map(item => [item.systemId, item]));
    }, [lockedQuery.data]);

    const handleLockConfirm = async (reason) => {
        if (!activeCredential) return;
        const systemId = activeCredential.systemId || activeCredential.system;
        const systemName = activeCredential.systemConfig?.description || systemId;

        try {
            await lockMutation.mutateAsync({
                userId,
                systemId,
                reason,
                userName,
                userEmail,
                systemName
            });
            setNotification({ type: 'success', message: 'Credential locked successfully.' });
            setModalType(null);
            setActiveCredential(null);
        } catch (error) {
            setNotification({
                type: 'error',
                message: error.problemDetails?.detail || error.message || 'Failed to lock credential'
            });
        }
    };

    const handleUnlockConfirm = async () => {
        if (!activeCredential) return;
        const systemId = activeCredential.systemId || activeCredential.system;

        try {
            await unlockMutation.mutateAsync({ userId, systemId });
            setNotification({ type: 'success', message: 'Credential unlocked successfully.' });
            setModalType(null);
            setActiveCredential(null);
        } catch (error) {
            setNotification({
                type: 'error',
                message: error.problemDetails?.detail || error.message || 'Failed to unlock credential'
            });
        }
    };

    const openLockModal = (credential) => {
        setActiveCredential(credential);
        setModalType('lock');
    };

    const openUnlockModal = (credential) => {
        setActiveCredential(credential);
        setModalType('unlock');
    };

    const closeModal = () => {
        setModalType(null);
        setActiveCredential(null);
        lockMutation.reset();
        unlockMutation.reset();
    };

    if (!credentials || credentials.length === 0) {
        return (
            <div className="credentials-empty">
                <p>No active credentials for this user.</p>
            </div>
        );
    }

    return (
        <div className="credential-list-wrapper">
            {notification && (
                <div className={`notification notification-${notification.type}`}>
                    {notification.message}
                    <button className="notification-close" onClick={() => setNotification(null)}>
                        ×
                    </button>
                </div>
            )}

            <div className="credentials-list">
                {credentials.map((credential) => {
                    const systemId = credential.systemId || credential.system;
                    const systemName = credential.systemConfig?.description || systemId;
                    const lockInfo = lockedMap.get(systemId);
                    const showLockDetails = expandedLock === systemId;

                    const lockDetailsText = lockInfo
                        ? `Locked by ${lockInfo.lockedByName || lockInfo.lockedBy || 'Unknown'} on ${formatDate(lockInfo.lockedAt)}${lockInfo.lockReason ? ` • ${lockInfo.lockReason}` : ''}`
                        : '';

                    return (
                        <div key={credential.id} className={`credential-item ${lockInfo ? 'credential-item--locked' : ''}`}>
                            <div className="credential-main">
                                <div className="credential-system">
                                    <span className="system-name">{systemName}</span>
                                    {credential.systemConfig?.isItOnly && <ItOnlyBadge />}
                                    {lockInfo && (
                                        <button
                                            type="button"
                                            className="lock-badge"
                                            title={lockDetailsText}
                                            onClick={() => setExpandedLock(showLockDetails ? null : systemId)}
                                        >
                                            🔒 Locked
                                        </button>
                                    )}
                                </div>
                                <div className="credential-details">
                                    <span className="credential-username">{credential.username}</span>
                                    <span className="credential-version">v{credential.templateVersion}</span>
                                </div>
                                {lockInfo && showLockDetails && (
                                    <div className="lock-details">
                                        <div>Locked by {lockInfo.lockedByName || lockInfo.lockedBy || 'Unknown'}</div>
                                        <div>Locked at {formatDate(lockInfo.lockedAt)}</div>
                                        {lockInfo.lockReason && <div>Reason: {lockInfo.lockReason}</div>}
                                    </div>
                                )}
                            </div>

                            {canManageLocks && (
                                <div className="credential-actions">
                                    {lockInfo ? (
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => openUnlockModal(credential)}
                                            disabled={unlockMutation.isPending}
                                        >
                                            Unlock
                                        </button>
                                    ) : (
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => openLockModal(credential)}
                                            disabled={lockMutation.isPending}
                                        >
                                            Lock
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <LockCredentialModal
                isOpen={modalType === 'lock'}
                credential={activeCredential}
                userName={userName}
                onConfirm={handleLockConfirm}
                onClose={closeModal}
                isLoading={lockMutation.isPending}
                error={lockMutation.error}
            />

            <UnlockCredentialModal
                isOpen={modalType === 'unlock'}
                credential={activeCredential}
                userName={userName}
                onConfirm={handleUnlockConfirm}
                onClose={closeModal}
                isLoading={unlockMutation.isPending}
                error={unlockMutation.error}
            />
        </div>
    );
};

export default CredentialList;
