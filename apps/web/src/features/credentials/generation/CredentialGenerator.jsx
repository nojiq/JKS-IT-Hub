import { useState } from 'react';
import {
    usePreviewCredentials,
    useConfirmCredentials,
    useUserCredentials,
    usePreviewOverride,
    useConfirmOverride
} from '../hooks/useCredentials.js';
import CredentialList from './CredentialList.jsx';
import GenerationError from './GenerationError.jsx';
import CredentialPreview from '../preview/CredentialPreview.jsx';
import DisabledUserBanner from '../components/DisabledUserBanner.jsx';
import { CredentialOverrideModal } from '../override/index.js';
import { useToast } from '../../../shared/hooks/useToast.js';
import { useSystemConfigs } from '../../system-configs/hooks/useSystemConfigs.js';
import './CredentialGenerator.css';

const CredentialGenerator = ({ userId, userName, userStatus, onEnableUser, canEnableUser = false }) => {
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [generationError, setGenerationError] = useState(null);
    const [selectedCredential, setSelectedCredential] = useState(null);
    const [selectedSystemId, setSelectedSystemId] = useState("");
    const toast = useToast();
    const { data: systemsResponse } = useSystemConfigs();
    const systemConfigs = systemsResponse?.data ?? [];

    const { data: credentialsData, isLoading: isLoadingCredentials, refetch } = useUserCredentials(userId);
    const previewMutation = usePreviewCredentials();
    const confirmMutation = useConfirmCredentials();
    const previewOverrideMutation = usePreviewOverride();
    const confirmOverrideMutation = useConfirmOverride();

    const handlePreviewRequest = async () => {
        setGenerationError(null);
        try {
            const result = await previewMutation.mutateAsync({
                userId,
                systemId: selectedSystemId || undefined
            });
            setPreviewData(result.data);
            setShowPreview(true);
        } catch (error) {
            setGenerationError(error);
            setShowPreview(false);
        }
    };

    const handleConfirm = async (previewToken) => {
        setGenerationError(null);
        try {
            await confirmMutation.mutateAsync({ 
                userId, 
                previewToken, 
                confirmed: true 
            });
            setShowPreview(false);
            setPreviewData(null);
            refetch();
        } catch (error) {
            setGenerationError(error);
        }
    };

    const handleCancel = () => {
        setShowPreview(false);
        setPreviewData(null);
    };

    const handleRetry = () => {
        setGenerationError(null);
        handlePreviewRequest();
    };

    const handleOpenOverride = (credential) => {
        setSelectedCredential(credential);
    };

    const handleCloseOverride = () => {
        setSelectedCredential(null);
    };

    const handleOverridePreview = async (targetUserId, system, overrideData) => {
        return previewOverrideMutation.mutateAsync({
            userId: targetUserId,
            system,
            overrideData
        });
    };

    const handleOverrideConfirm = async (targetUserId, system, previewToken) => {
        const result = await confirmOverrideMutation.mutateAsync({
            userId: targetUserId,
            system,
            previewToken
        });
        toast.success("Credential overridden successfully", `${system} credential updated for ${userName}.`);
        await refetch();
        return result;
    };

    const isProcessing = previewMutation.isPending || confirmMutation.isPending;
    const isOverrideProcessing = previewOverrideMutation.isPending || confirmOverrideMutation.isPending;
    const isUserDisabled = userStatus === 'disabled';

    return (
        <div className="credential-generator">
            {isUserDisabled && (
                <DisabledUserBanner
                    userName={userName}
                    userStatus={userStatus}
                    onEnableUser={onEnableUser}
                    canEnableUser={canEnableUser}
                />
            )}

            <div className="generator-header">
                <h2>Credential Management</h2>
                <p className="user-info">
                    Managing credentials for: <strong>{userName}</strong>
                </p>
            </div>

            <div className="generator-actions">
                <label style={{ display: "grid", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                        Generation Scope
                    </span>
                    <select
                        value={selectedSystemId}
                        onChange={(event) => setSelectedSystemId(event.target.value)}
                        disabled={isProcessing}
                        style={{ maxWidth: "320px" }}
                    >
                        <option value="">All Systems (template default)</option>
                        {systemConfigs.map((config) => (
                            <option key={config.systemId} value={config.systemId}>
                                {config.systemId} ({config.usernameLdapField})
                            </option>
                        ))}
                    </select>
                </label>
                <button
                    className="btn-generate"
                    onClick={handlePreviewRequest}
                    disabled={isProcessing || isUserDisabled}
                    title={isUserDisabled ? 'Cannot generate credentials for disabled users' : ''}
                >
                    {isProcessing ? 'Processing...' : 'Generate Credentials'}
                </button>
            </div>

            {isUserDisabled && (
                <div className="warning-message">
                    Credential generation is disabled while user account is disabled.
                </div>
            )}

            {generationError && !showPreview && (
                <GenerationError 
                    error={generationError} 
                    onRetry={handleRetry}
                />
            )}

            {showPreview && previewData && (
                <CredentialPreview
                    previewData={previewData}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                    isLoading={confirmMutation.isPending}
                    error={confirmMutation.error}
                />
            )}

            {isLoadingCredentials ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading credentials...</p>
                </div>
            ) : (
                <CredentialList 
                    credentials={credentialsData?.data}
                    onViewHistory={(credentialId) => {
                        console.log('View history for:', credentialId);
                    }}
                    onOverride={handleOpenOverride}
                />
            )}

            <CredentialOverrideModal
                isOpen={Boolean(selectedCredential)}
                onClose={handleCloseOverride}
                credential={selectedCredential}
                userId={userId}
                onPreview={handleOverridePreview}
                onConfirm={handleOverrideConfirm}
                isLoading={isOverrideProcessing}
                userStatus={userStatus}
                onEnableUser={onEnableUser}
                canEnableUser={canEnableUser}
            />
        </div>
    );
};

export default CredentialGenerator;
