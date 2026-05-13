import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as credentialsApi from '../api/credentials.js';

const CREDENTIALS_QUERY_KEY = 'credentials';

export const useUserCredentials = (userId) => {
    return useQuery({
        queryKey: [CREDENTIALS_QUERY_KEY, 'user', userId],
        queryFn: () => credentialsApi.getUserCredentials(userId),
        enabled: !!userId
    });
};

export const useGenerateCredentials = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: ({ userId, systemId }) => credentialsApi.generateCredentials(userId, systemId),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [CREDENTIALS_QUERY_KEY, 'user', variables.userId]
            });
        }
    });
};

export const usePreviewCredentials = () => {
    return useMutation({
        mutationFn: ({ userId, systemId }) => credentialsApi.previewCredentials(userId, systemId)
    });
};

export const useCredentialDetail = (credentialId) => {
    return useQuery({
        queryKey: [CREDENTIALS_QUERY_KEY, 'detail', credentialId],
        queryFn: () => credentialsApi.getCredentialDetail(credentialId),
        enabled: !!credentialId
    });
};

export const useCredentialVersions = (credentialId) => {
    return useQuery({
        queryKey: [CREDENTIALS_QUERY_KEY, 'versions', credentialId],
        queryFn: () => credentialsApi.getCredentialVersions(credentialId),
        enabled: !!credentialId
    });
};

export const useConfirmCredentials = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: ({ userId, previewToken, confirmed }) => 
            credentialsApi.confirmCredentials(userId, { previewToken, confirmed }),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [CREDENTIALS_QUERY_KEY, 'user', variables.userId]
            });
        }
    });
};

// Credential Regeneration Hooks (Story 2.4)

export const useInitiateRegeneration = () => {
    return useMutation({
        mutationFn: ({ userId, systemId }) => credentialsApi.initiateRegeneration(userId, systemId)
    });
};

export const usePreviewRegeneration = () => {
    return useMutation({
        mutationFn: ({ userId }) => credentialsApi.previewRegeneration(userId)
    });
};

export const useConfirmRegeneration = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: ({ userId, previewToken, confirmed, acknowledgedWarnings }) =>
            credentialsApi.confirmRegeneration(userId, { previewToken, confirmed, acknowledgedWarnings }),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [CREDENTIALS_QUERY_KEY, 'user', variables.userId]
            });
        }
    });
};

// Credential History Hooks (Story 2.5)

export const useCredentialHistory = (userId, filters = {}) => {
    return useQuery({
        queryKey: [CREDENTIALS_QUERY_KEY, 'history', userId, filters],
        queryFn: () => credentialsApi.getCredentialHistory(userId, filters),
        enabled: !!userId,
        placeholderData: keepPreviousData
    });
};

export const useCredentialVersion = (versionId) => {
    return useQuery({
        queryKey: [CREDENTIALS_QUERY_KEY, 'version', versionId],
        queryFn: () => credentialsApi.getCredentialVersion(versionId),
        enabled: !!versionId
    });
};

export const useCompareVersions = () => {
    return useMutation({
        mutationFn: ({ versionId1, versionId2 }) => 
            credentialsApi.compareCredentialVersions(versionId1, versionId2)
    });
};

export const useRevealPassword = () => {
    return useMutation({
        mutationFn: ({ versionId }) => 
            credentialsApi.revealCredentialPassword(versionId)
    });
};

// Credential Override Hooks (Story 2.6)

export const usePreviewOverride = () => {
    return useMutation({
        mutationFn: ({ userId, system, overrideData }) => 
            credentialsApi.previewOverride(userId, system, overrideData)
    });
};

export const useConfirmOverride = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: ({ userId, system, previewToken }) => 
            credentialsApi.confirmOverride(userId, system, previewToken),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [CREDENTIALS_QUERY_KEY, 'user', variables.userId]
            });
        }
    });
};
