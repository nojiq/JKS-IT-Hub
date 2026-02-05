import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as systemConfigsApi from "../api/systemConfigs.js";

const SYSTEM_CONFIGS_QUERY_KEY = "system-configs";

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
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [SYSTEM_CONFIGS_QUERY_KEY]
            });
        }
    });
};

export const useUpdateSystemConfig = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: ({ systemId, data }) => systemConfigsApi.updateSystemConfig(systemId, data),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [SYSTEM_CONFIGS_QUERY_KEY]
            });
            queryClient.invalidateQueries({
                queryKey: [SYSTEM_CONFIGS_QUERY_KEY, variables.systemId]
            });
        }
    });
};

export const useDeleteSystemConfig = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: systemConfigsApi.deleteSystemConfig,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [SYSTEM_CONFIGS_QUERY_KEY]
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
