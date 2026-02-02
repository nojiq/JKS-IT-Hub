import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTemplates, fetchTemplate, createTemplate, updateTemplate } from "../api/templates.js";

export const useTemplates = () => {
    return useQuery({
        queryKey: ["credential-templates"],
        queryFn: fetchTemplates
    });
};

export const useTemplate = (id) => {
    return useQuery({
        queryKey: ["credential-templates", id],
        queryFn: () => fetchTemplate(id),
        enabled: !!id
    });
};

export const useCreateTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createTemplate,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["credential-templates"] });
        }
    });
};

export const useUpdateTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => updateTemplate(id, data),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["credential-templates"] });
            queryClient.invalidateQueries({ queryKey: ["credential-templates", variables.id] });
        }
    });
};
