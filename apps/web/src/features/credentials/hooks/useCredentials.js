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
        mutationFn: ({ userId, previewToken, confirmed, skipLocked, force }) => 
            credentialsApi.confirmRegeneration(userId, { previewToken, confirmed, skipLocked, force }),
        onSuccess: (data, variables) => {
            // Invalidate user credentials cache
            queryClient.invalidateQueries({
                queryKey: [CREDENTIALS_QUERY_KEY, 'user', variables.userId]
            });
            queryClient.invalidateQueries({
                queryKey: [CREDENTIALS_QUERY_KEY, 'locked', variables.userId]
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
        keepPreviousData: true
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
            // Invalidate user credentials cache to refresh the list
            queryClient.invalidateQueries({
                queryKey: [CREDENTIALS_QUERY_KEY, 'user', variables.userId]
            });
        }
    });
};

// Credential Lock Hooks (Story 2.9)

const updateLockedCaches = (queryClient, updater) => {
    const entries = queryClient.getQueriesData({ queryKey: [CREDENTIALS_QUERY_KEY, 'locked'] });
    entries.forEach(([queryKey, data]) => {
        if (!data || !Array.isArray(data.data)) return;
        const next = updater(data);
        queryClient.setQueryData(queryKey, next);
    });
};

export const useUserLockedCredentials = (userId, filters = {}) => {
    return useQuery({
        queryKey: [CREDENTIALS_QUERY_KEY, 'locked', userId, filters],
        queryFn: () => credentialsApi.getUserLockedCredentials(userId, filters),
        enabled: !!userId,
        keepPreviousData: true
    });
};

export const useLockedCredentials = (filters = {}) => {
    return useQuery({
        queryKey: [CREDENTIALS_QUERY_KEY, 'locked', 'all', filters],
        queryFn: () => credentialsApi.getLockedCredentials(filters),
        keepPreviousData: true
    });
};

export const useLockCredential = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, systemId, reason }) =>
            credentialsApi.lockCredential(userId, systemId, reason),
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: [CREDENTIALS_QUERY_KEY, 'locked'] });

            const previous = queryClient.getQueriesData({ queryKey: [CREDENTIALS_QUERY_KEY, 'locked'] });
            const optimisticEntry = {
                id: `optimistic-${variables.userId}-${variables.systemId}`,
                userId: variables.userId,
                userName: variables.userName || variables.userId,
                userEmail: variables.userEmail || null,
                systemId: variables.systemId,
                systemName: variables.systemName || variables.systemId,
                lockedBy: variables.lockedBy || null,
                lockedByName: variables.lockedByName || null,
                lockedAt: new Date().toISOString(),
                lockReason: variables.reason || null,
                isOptimistic: true
            };

            updateLockedCaches(queryClient, (data) => ({
                ...data,
                data: [...data.data, optimisticEntry]
            }));

            return { previous };
        },
        onError: (_error, _variables, context) => {
            if (!context?.previous) return;
            context.previous.forEach(([queryKey, data]) => {
                queryClient.setQueryData(queryKey, data);
            });
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [CREDENTIALS_QUERY_KEY, 'locked']
            });
            if (variables?.userId) {
                queryClient.invalidateQueries({
                    queryKey: [CREDENTIALS_QUERY_KEY, 'locked', variables.userId]
                });
            }
        }
    });
};

export const useUnlockCredential = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, systemId }) =>
            credentialsApi.unlockCredential(userId, systemId),
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: [CREDENTIALS_QUERY_KEY, 'locked'] });

            const previous = queryClient.getQueriesData({ queryKey: [CREDENTIALS_QUERY_KEY, 'locked'] });
            updateLockedCaches(queryClient, (data) => ({
                ...data,
                data: data.data.filter(item => !(item.userId === variables.userId && item.systemId === variables.systemId))
            }));

            return { previous };
        },
        onError: (_error, _variables, context) => {
            if (!context?.previous) return;
            context.previous.forEach(([queryKey, data]) => {
                queryClient.setQueryData(queryKey, data);
            });
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [CREDENTIALS_QUERY_KEY, 'locked']
            });
            if (variables?.userId) {
                queryClient.invalidateQueries({
                    queryKey: [CREDENTIALS_QUERY_KEY, 'locked', variables.userId]
                });
            }
        }
    });
};
