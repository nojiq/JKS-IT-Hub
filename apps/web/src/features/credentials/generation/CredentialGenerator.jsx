import { useState } from 'react';
import { usePreviewCredentials, useConfirmCredentials, useUserCredentials } from '../hooks/useCredentials.js';
import CredentialList from './CredentialList.jsx';
import GenerationError from './GenerationError.jsx';
import CredentialPreview from '../preview/CredentialPreview.jsx';
import DisabledUserBanner from '../components/DisabledUserBanner.jsx';
import './CredentialGenerator.css';

const CredentialGenerator = ({ userId, userName, userStatus }) => {
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [generationError, setGenerationError] = useState(null);

    const { data: credentialsData, isLoading: isLoadingCredentials, refetch } = useUserCredentials(userId);
    const previewMutation = usePreviewCredentials();
    const confirmMutation = useConfirmCredentials();

    const handlePreviewRequest = async () => {
        setGenerationError(null);
        try {
            const result = await previewMutation.mutateAsync({ userId });
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

    const isProcessing = previewMutation.isPending || confirmMutation.isPending;
    const isUserDisabled = userStatus === 'disabled';

    return (
        <div className="credential-generator">
            {isUserDisabled && (
                <DisabledUserBanner
                    userName={userName}
                    userStatus={userStatus}
                />
            )}

            <div className="generator-header">
                <h2>Credential Management</h2>
                <p className="user-info">
                    Managing credentials for: <strong>{userName}</strong>
                </p>
            </div>

            <div className="generator-actions">
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
                />
            )}
        </div>
    );
};

export default CredentialGenerator;
