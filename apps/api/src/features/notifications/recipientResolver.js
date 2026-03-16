
import { prisma } from '../../shared/db/prisma.js';

export const getUserEmail = async (userId) => {
    if (!userId) return null;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { ldapAttributes: true, username: true }
    });

    // Check if ldapAttributes exists and has mail property
    if (!user?.ldapAttributes) return null;

    // Support nested structure if present, but typically it flat attributes object
    const attributes = user.ldapAttributes;
    return attributes.mail || attributes.email || null;
};

export const getITStaffEmails = async () => {
    const users = await prisma.user.findMany({
        where: {
            role: { in: ['it', 'admin', 'head_it'] },
            status: 'active'
        },
        select: { ldapAttributes: true }
    });

    return users
        .map(u => u.ldapAttributes && (u.ldapAttributes.mail || u.ldapAttributes.email))
        .filter(Boolean); // Filter out null/undefined/empty
};

export const getApproverEmails = async () => {
    const users = await prisma.user.findMany({
        where: {
            role: { in: ['admin', 'head_it'] },
            status: 'active'
        },
        select: { ldapAttributes: true }
    });

    return users
        .map(u => u.ldapAttributes && (u.ldapAttributes.mail || u.ldapAttributes.email))
        .filter(Boolean);
};

/**
 * Get user IDs for IT staff (for in-app notifications)
 */
export const getITStaffIds = async () => {
    const users = await prisma.user.findMany({
        where: {
            role: { in: ['it', 'admin', 'head_it'] },
            status: 'active'
        },
        select: { id: true }
    });

    return users.map(u => u.id);
};

/**
 * Get user IDs for approvers (for in-app notifications)
 */
export const getApproverIds = async () => {
    const users = await prisma.user.findMany({
        where: {
            role: { in: ['admin', 'head_it'] },
            status: 'active'
        },
        select: { id: true }
    });

    return users.map(u => u.id);
};

/**
 * Get email addresses of technicians assigned to a maintenance window
 */
export const getTechnicianEmailsForWindow = async (windowId) => {
    const window = await prisma.maintenanceWindow.findUnique({
        where: { id: windowId },
        select: {
            assignedTo: {
                select: {
                    ldapAttributes: true
                }
            }
        }
    });

    if (!window?.assignedTo) return [];

    const attrs = window.assignedTo.ldapAttributes; // attributes is Json object

    if (!attrs) return [];

    // Assuming email is in mail or email attribute
    const email = attrs.mail || attrs.email;
    return email ? [email] : [];
};

/**
 * Get user IDs of technicians assigned to a maintenance window
 */
export const getTechnicianIdsForWindow = async (windowId) => {
    const window = await prisma.maintenanceWindow.findUnique({
        where: { id: windowId },
        select: { assignedToId: true }
    });

    return window?.assignedToId ? [window.assignedToId] : [];
};
