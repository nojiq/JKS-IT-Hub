import { useMutation, useQuery } from '@tanstack/react-query';
import * as credentialsApi from '../api/credentials.js';

export const useImapWorkbench = (userId) => {
    return useQuery({
        queryKey: ['imap-generator', 'workbench', userId],
        queryFn: () => credentialsApi.getImapWorkbench(userId),
        enabled: Boolean(userId)
    });
};

export const useImapPreview = () => {
    return useMutation({
        mutationFn: (payload) => credentialsApi.previewImapPassword(payload)
    });
};

export const useImapSave = () => {
    return useMutation({
        mutationFn: (payload) => credentialsApi.saveImapPassword(payload)
    });
};

export const usePreviousImapPasswords = (userId) => {
    return useQuery({
        queryKey: ['imap-generator', 'passwords', userId],
        queryFn: () => credentialsApi.getPreviousImapPasswords(userId),
        enabled: Boolean(userId)
    });
};

export const useImapConflictReview = () => {
    return useMutation({
        mutationFn: ({ userId, payload }) => credentialsApi.reviewImapConflicts(userId, payload)
    });
};
