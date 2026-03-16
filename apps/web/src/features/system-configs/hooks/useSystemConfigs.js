import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as systemConfigsApi from "../api/systemConfigs.js";

const SYSTEM_CONFIGS_QUERY_KEY = "system-configs";
const SYSTEM_CONFIGS_LIST_QUERY = [SYSTEM_CONFIGS_QUERY_KEY];

const withUpdatedMeta = (payload) => ({
    ...payload,
    meta: {
        ...(payload.meta || {}),
        count: Array.isArray(payload.data) ? payload.data.length : 0
    }
});

export const useSystemConfigs = () => {
    return useQuery({
        queryKey: [SYSTEM_CONFIGS_QUERY_KEY],
        queryFn: systemConfigsApi.getSystemConfigs
    });
};

export const useSystemConfig = (systemId) => {
    return useQuery({
        queryKey: [SYSTEM_CONFIGS_QUERY_KEY, systemId],
        queryFn: () => systemConfigsApi.getSystemConfig(systemId),
        enabled: !!systemId
    });
};

export const useCreateSystemConfig = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: systemConfigsApi.createSystemConfig,
        onMutate: async (newConfig) => {
            await queryClient.cancelQueries({ queryKey: SYSTEM_CONFIGS_LIST_QUERY });
            const previous = queryClient.getQueryData(SYSTEM_CONFIGS_LIST_QUERY);

            queryClient.setQueryData(SYSTEM_CONFIGS_LIST_QUERY, (current) => {
                const currentData = current?.data || [];
                const optimistic = {
                    id: `optimistic-${newConfig.systemId}`,
                    systemId: newConfig.systemId,
                    usernameLdapField: newConfig.usernameLdapField,
                    description: newConfig.description || null,
                    isItOnly: Boolean(newConfig.isItOnly),
                    isOptimistic: true
                };
                return withUpdatedMeta({
                    ...(current || {}),
                    data: [...currentData, optimistic]
                });
            });

            return { previous };
        },
        onError: (_error, _variables, context) => {
            if (context?.previous !== undefined) {
                queryClient.setQueryData(SYSTEM_CONFIGS_LIST_QUERY, context.previous);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: SYSTEM_CONFIGS_LIST_QUERY
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: SYSTEM_CONFIGS_LIST_QUERY
            });
        }
    });
};

export const useUpdateSystemConfig = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: ({ systemId, data }) => systemConfigsApi.updateSystemConfig(systemId, data),
        onMutate: async ({ systemId, data }) => {
            await queryClient.cancelQueries({ queryKey: SYSTEM_CONFIGS_LIST_QUERY });
            const previous = queryClient.getQueryData(SYSTEM_CONFIGS_LIST_QUERY);

            queryClient.setQueryData(SYSTEM_CONFIGS_LIST_QUERY, (current) => {
                const currentData = current?.data || [];
                return withUpdatedMeta({
                    ...(current || {}),
                    data: currentData.map((item) => (
                        item.systemId === systemId ? { ...item, ...data } : item
                    ))
                });
            });

            return { previous };
        },
        onError: (_error, _variables, context) => {
            if (context?.previous !== undefined) {
                queryClient.setQueryData(SYSTEM_CONFIGS_LIST_QUERY, context.previous);
            }
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: SYSTEM_CONFIGS_LIST_QUERY
            });
            queryClient.invalidateQueries({
                queryKey: [SYSTEM_CONFIGS_QUERY_KEY, variables.systemId]
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: SYSTEM_CONFIGS_LIST_QUERY
            });
        }
    });
};

export const useDeleteSystemConfig = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: systemConfigsApi.deleteSystemConfig,
        onMutate: async (systemId) => {
            await queryClient.cancelQueries({ queryKey: SYSTEM_CONFIGS_LIST_QUERY });
            const previous = queryClient.getQueryData(SYSTEM_CONFIGS_LIST_QUERY);

            queryClient.setQueryData(SYSTEM_CONFIGS_LIST_QUERY, (current) => {
                const currentData = current?.data || [];
                return withUpdatedMeta({
                    ...(current || {}),
                    data: currentData.filter((item) => item.systemId !== systemId)
                });
            });

            return { previous };
        },
        onError: (_error, _variables, context) => {
            if (context?.previous !== undefined) {
                queryClient.setQueryData(SYSTEM_CONFIGS_LIST_QUERY, context.previous);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: SYSTEM_CONFIGS_LIST_QUERY
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: SYSTEM_CONFIGS_LIST_QUERY
            });
        }
    });
};

export const useAvailableLdapFields = () => {
    return useQuery({
        queryKey: [SYSTEM_CONFIGS_QUERY_KEY, "ldap-fields"],
        queryFn: systemConfigsApi.getAvailableLdapFields
    });
};
