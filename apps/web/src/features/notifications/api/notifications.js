
import { apiFetch } from "../../../shared/utils/api-client.js";

const parseResponse = async (response, fallbackMessage) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.detail || payload.title || fallbackMessage);
    }
    return payload;
};

export const getNotifications = async ({ page = 1, limit = 20, isRead }) => {
    const params = new URLSearchParams({ page, limit });
    if (isRead !== undefined && isRead !== null) {
        params.append('isRead', isRead);
    }
    const response = await apiFetch(`/api/v1/notifications?${params.toString()}`);
    return parseResponse(response, "Failed to fetch notifications");
};

export const getUnreadCount = async () => {
    const response = await apiFetch('/api/v1/notifications/unread-count');
    return parseResponse(response, "Failed to get unread count");
};

export const markAsRead = async (id) => {
    const response = await apiFetch(`/api/v1/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
    });
    return parseResponse(response, "Failed to mark notification as read");
};

export const markAllAsRead = async () => {
    const response = await apiFetch('/api/v1/notifications/read-all', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
    });
    return parseResponse(response, "Failed to mark all as read");
};
