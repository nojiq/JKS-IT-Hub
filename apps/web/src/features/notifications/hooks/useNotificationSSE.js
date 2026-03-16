import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSSE } from '../../../shared/hooks/useSSE.js';

export const useNotificationSSE = (enabled = true) => {
    const queryClient = useQueryClient();
    const invalidateNotifications = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }, [queryClient]);

    useSSE(enabled ? 'notification' : null, invalidateNotifications);
    useSSE(enabled ? 'notification.maintenance.upcoming' : null, invalidateNotifications);
    useSSE(enabled ? 'notification.maintenance.overdue' : null, invalidateNotifications);
};
