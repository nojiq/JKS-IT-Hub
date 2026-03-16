import { useMutation, useQueryClient } from "@tanstack/react-query";
import { approveRequest } from "../api/requestsApi";

export const useAdminApproval = () => {
    const queryClient = useQueryClient();

    const approveMutation = useMutation({
        mutationFn: (id) => approveRequest(id),
        onSuccess: () => {
            // Invalidate list and details
            queryClient.invalidateQueries({ queryKey: ["requests"] });
        }
    });

    return {
        approveRequest: approveMutation.mutateAsync,
        isApproving: approveMutation.isPending,
        error: approveMutation.error
    };
};
