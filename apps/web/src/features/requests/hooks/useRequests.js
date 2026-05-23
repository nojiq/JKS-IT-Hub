import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    createPurchaseRecord,
    fetchMyPurchaseRecords,
    fetchPurchaseRecordDetails,
    fetchAllPurchaseRecords,
    verifyPurchaseRecordItemSnipe
} from "../api/purchaseRecordsApi.js";

export const purchaseRecordsKeys = {
    all: ["purchase-records"],
    myParams: (filters) => ["purchase-records", "my", filters],
    detail: (id) => ["purchase-records", id]
};

/** @deprecated Use purchaseRecordsKeys */
export const requestsKeys = purchaseRecordsKeys;

export const useSubmitPurchaseRecord = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createPurchaseRecord,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: purchaseRecordsKeys.all });
        }
    });
};

/** @deprecated Use useSubmitPurchaseRecord */
export const useSubmitRequest = useSubmitPurchaseRecord;

export const useMyPurchaseRecords = (filters = {}) => {
    return useQuery({
        queryKey: purchaseRecordsKeys.myParams(filters),
        queryFn: () => fetchMyPurchaseRecords(filters),
        placeholderData: keepPreviousData
    });
};

/** @deprecated Use useMyPurchaseRecords */
export const useMyRequests = useMyPurchaseRecords;

export const usePurchaseRecordDetails = (id) => {
    return useQuery({
        queryKey: purchaseRecordsKeys.detail(id),
        queryFn: () => fetchPurchaseRecordDetails(id),
        enabled: !!id
    });
};

/** @deprecated Use usePurchaseRecordDetails */
export const useRequestDetails = usePurchaseRecordDetails;

export const useAllPurchaseRecords = (filters = {}) => {
    return useQuery({
        queryKey: ["purchase-records", "admin", filters],
        queryFn: () => fetchAllPurchaseRecords(filters),
        placeholderData: keepPreviousData
    });
};

/** @deprecated Use useAllPurchaseRecords */
export const useAllRequests = useAllPurchaseRecords;

export const useVerifyPurchaseRecordItemSnipe = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ recordId, itemId, payload }) =>
            verifyPurchaseRecordItemSnipe(recordId, itemId, payload),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: purchaseRecordsKeys.all });
            if (variables?.recordId) {
                queryClient.invalidateQueries({
                    queryKey: purchaseRecordsKeys.detail(variables.recordId)
                });
            }
        }
    });
};
