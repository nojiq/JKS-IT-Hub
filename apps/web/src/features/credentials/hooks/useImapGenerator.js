import { useMutation, useQuery } from '@tanstack/react-query';
import * as credentialsApi from '../api/credentials.js';

export const useImapWorkbench = (userId) => {
    return useQuery({
        queryKey: ['imap-generator', 'workbench', userId],
        queryFn: async () => {
            const payload = await credentialsApi.getImapWorkbench(userId);
            return payload.data;
        },
        enabled: Boolean(userId)
    });
};

export const useActualPasswordPreview = () => {
    return useMutation({
        mutationFn: async (payload) => {
            const response = await credentialsApi.previewActualPassword(payload);
            return response.data;
        }
    });
};

export const useImapSave = () => {
    return useMutation({
        mutationFn: async (payload) => {
            const response = await credentialsApi.saveImapPassword(payload);
            return response.data;
        }
    });
};

export const usePreviousImapPasswords = (userId) => {
    return useQuery({
        queryKey: ['imap-generator', 'passwords', userId],
        queryFn: async () => {
            const payload = await credentialsApi.getPreviousImapPasswords(userId);
            return payload.data;
        },
        enabled: Boolean(userId)
    });
};
