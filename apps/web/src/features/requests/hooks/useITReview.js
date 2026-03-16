import { useMutation, useQueryClient } from "@tanstack/react-query";
import { itReviewRequest, markAlreadyPurchased, rejectRequest } from "../api/requestsApi";

export const useITReview = () => {
    const queryClient = useQueryClient();

    const reviewMutation = useMutation({
        mutationFn: ({ id, data }) => itReviewRequest(id, data),
        onSuccess: () => {
            // Invalidate list and details
            queryClient.invalidateQueries({ queryKey: ["requests"] });
        }
    });

    const alreadyPurchasedMutation = useMutation({
        mutationFn: ({ id, data }) => markAlreadyPurchased(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["requests"] });
        }
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, data }) => rejectRequest(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["requests"] });
        }
    });

    return {
        itReview: reviewMutation.mutateAsync,
        markAlreadyPurchased: alreadyPurchasedMutation.mutateAsync,
        rejectRequest: rejectMutation.mutateAsync,
        isReviewing: reviewMutation.isPending,
        isMarkingPurchased: alreadyPurchasedMutation.isPending,
        isRejecting: rejectMutation.isPending,
        error: reviewMutation.error || alreadyPurchasedMutation.error || rejectMutation.error
    };
};
