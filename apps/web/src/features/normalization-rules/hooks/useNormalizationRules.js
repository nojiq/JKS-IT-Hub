import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as normalizationApi from "../api/normalizationRules.js";

const NORMALIZATION_RULES_QUERY_KEY = "normalization-rules";

export const useNormalizationRules = () => {
    return useQuery({
        queryKey: [NORMALIZATION_RULES_QUERY_KEY],
        queryFn: normalizationApi.getNormalizationRules
    });
};

export const useCreateNormalizationRule = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: normalizationApi.createNormalizationRule,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [NORMALIZATION_RULES_QUERY_KEY]
            });
        }
    });
};

export const useUpdateNormalizationRule = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ ruleId, data }) => normalizationApi.updateNormalizationRule(ruleId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [NORMALIZATION_RULES_QUERY_KEY]
            });
        }
    });
};

export const useDeleteNormalizationRule = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: normalizationApi.deleteNormalizationRule,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [NORMALIZATION_RULES_QUERY_KEY]
            });
        }
    });
};

export const useReorderNormalizationRules = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: normalizationApi.reorderNormalizationRules,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [NORMALIZATION_RULES_QUERY_KEY]
            });
        }
    });
};

export const useNormalizationPreview = () => {
    return useMutation({
        mutationFn: ({ value, systemId }) => normalizationApi.previewNormalization(value, systemId)
    });
};
