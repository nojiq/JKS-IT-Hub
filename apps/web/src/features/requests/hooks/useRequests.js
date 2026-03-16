import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { submitRequest, fetchMyRequests, fetchRequestDetails, fetchAllRequests } from "../api/requestsApi.js";

// Query Keys
export const requestsKeys = {
    all: ['requests'],
    myParams: (filters) => ['requests', 'my', filters],
    detail: (id) => ['requests', id]
};

// Mutations
export const useSubmitRequest = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: submitRequest,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: requestsKeys.all });
        }
    });
};

// Queries
export const useMyRequests = (filters = {}) => {
    return useQuery({
        queryKey: requestsKeys.myParams(filters),
        queryFn: () => fetchMyRequests(filters),
        keepPreviousData: true
    });
};

export const useRequestDetails = (id) => {
    return useQuery({
        queryKey: requestsKeys.detail(id),
        queryFn: () => fetchRequestDetails(id),
        enabled: !!id
    });
};// ... (existing)

export const useAllRequests = (filters = {}) => {
    return useQuery({
        queryKey: ['requests', 'admin', filters],
        queryFn: () => fetchAllRequests(filters),
        keepPreviousData: true
    });
};
