import { prisma } from "../../shared/db/prisma.js";

export const createSystemConfig = async (data, tx = prisma) => {
    return tx.systemConfig.create({ data });
};

export const getSystemConfigs = async (tx = prisma) => {
    return tx.systemConfig.findMany({
        orderBy: { createdAt: 'asc' }
    });
};

export const getSystemConfigById = async (systemId, tx = prisma) => {
    return tx.systemConfig.findUnique({
        where: { systemId }
    });
};

export const updateSystemConfig = async (systemId, data, tx = prisma) => {
    return tx.systemConfig.update({
        where: { systemId },
        data
    });
};

export const deleteSystemConfig = async (systemId, tx = prisma) => {
    return tx.systemConfig.delete({
        where: { systemId }
    });
};

export const getCredentialCountForSystem = async (systemId, tx = prisma) => {
    return tx.userCredential.count({
        where: { 
            systemId,
            isActive: true
        }
    });
};

export const getAvailableLdapFields = async (tx = prisma) => {
    const sampleUsers = await tx.user.findMany({
        where: {
            ldapAttributes: { not: null }
        },
        take: 10,
        select: { ldapAttributes: true }
    });
    
    const fieldSet = new Set();
    sampleUsers.forEach(user => {
        if (user.ldapAttributes && typeof user.ldapAttributes === 'object') {
            Object.keys(user.ldapAttributes).forEach(field => fieldSet.add(field));
        }
    });
    
    return Array.from(fieldSet).sort();
};
