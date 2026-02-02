import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
        mutationFn: ({ userId }) => credentialsApi.generateCredentials(userId),
        onSuccess: (data, variables) => {
            // Invalidate user credentials cache
            queryClient.invalidateQueries({
                queryKey: [CREDENTIALS_QUERY_KEY, 'user', variables.userId]
            });
        }
    });
};

export const usePreviewCredentials = () => {
    return useMutation({
        mutationFn: ({ userId }) => credentialsApi.previewCredentials(userId)
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
            // Invalidate user credentials cache
            queryClient.invalidateQueries({
                queryKey: [CREDENTIALS_QUERY_KEY, 'user', variables.userId]
            });
        }
    });
};

// Credential Regeneration Hooks (Story 2.4)

export const useInitiateRegeneration = () => {
    return useMutation({
        mutationFn: ({ userId }) => credentialsApi.initiateRegeneration(userId)
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
        mutationFn: ({ userId, previewToken, confirmed }) => 
            credentialsApi.confirmRegeneration(userId, { previewToken, confirmed }),
        onSuccess: (data, variables) => {
            // Invalidate user credentials cache
            queryClient.invalidateQueries({
                queryKey: [CREDENTIALS_QUERY_KEY, 'user', variables.userId]
            });
        }
    });
};
