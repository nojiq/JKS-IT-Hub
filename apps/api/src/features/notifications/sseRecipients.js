import { getConnectedUserIdsByRoles } from './sseHandler.js';

const IT_RELATED_ROLES = ['it', 'admin', 'head_it'];

const dedupe = (values) => [...new Set(values.filter(Boolean))];

export const getRequestEventRecipients = (request) => {
    const itStaff = getConnectedUserIdsByRoles(IT_RELATED_ROLES);
    return dedupe([request?.requesterId, ...itStaff]);
};

export const getMaintenanceEventRecipients = (maintenance) => {
    const itStaff = getConnectedUserIdsByRoles(IT_RELATED_ROLES);
    const assignedUsers = Array.isArray(maintenance?.assignedToIds)
        ? maintenance.assignedToIds
        : [maintenance?.assignedToId];
    return dedupe([...assignedUsers, ...itStaff]);
};
