import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { uploadInvoice } from '../api/requestsApi.js';
import { requestsKeys } from './useRequests.js';

/**
 * Hook for uploading invoices to requests
 * Provides mutation state and automatic cache invalidation
 */
export const useUploadInvoice = () => {
    const queryClient = useQueryClient();
    const [progress, setProgress] = useState(0);

    const mutation = useMutation({
        mutationFn: ({ requestId, file }) => uploadInvoice(requestId, file, setProgress),
        onMutate: () => {
            setProgress(0);
        },
        onSuccess: (data, variables) => {
            // Invalidate request details query to refresh the data
            queryClient.invalidateQueries({
                queryKey: requestsKeys.detail(variables.requestId)
            });
            // Also invalidate the requests list
            queryClient.invalidateQueries({
                queryKey: requestsKeys.all
            });
            setProgress(100);
        },
        onSettled: () => {
            setTimeout(() => setProgress(0), 150);
        }
    });

    return {
        ...mutation,
        progress
    };
};

export default useUploadInvoice;
