
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/notifications.js';

export const useNotifications = ({ page = 1, limit = 20, isRead } = {}) => {
    return useQuery({
        queryKey: ['notifications', { page, limit, isRead }],
        queryFn: () => api.getNotifications({ page, limit, isRead }),
        placeholderData: keepPreviousData
    });
};

export const useUnreadCount = () => {
    return useQuery({
        queryKey: ['notifications', 'unread-count'],
        queryFn: api.getUnreadCount,
        refetchInterval: 60000 // Fallback polling every minute
    });
};

export const useMarkAsRead = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.markAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });
};

export const useMarkAllAsRead = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.markAllAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });
};
