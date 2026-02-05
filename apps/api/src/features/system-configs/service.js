import * as repo from "./repo.js";
import { prisma } from "../../shared/db/prisma.js";

/**
 * Error when LDAP field does not exist in schema
 */
export class LdapFieldNotFoundError extends Error {
    constructor(fieldName, availableFields) {
        super(`LDAP field '${fieldName}' does not exist in the synced attributes`);
        this.name = 'LdapFieldNotFoundError';
        this.code = 'LDAP_FIELD_NOT_FOUND';
        this.fieldName = fieldName;
        this.availableFields = availableFields;
    }
}

/**
 * Error when system is already in use and cannot be deleted
 */
export class SystemInUseError extends Error {
    constructor(systemId, credentialCount) {
        super(`Cannot delete system '${systemId}' because it has ${credentialCount} active credentials`);
        this.name = 'SystemInUseError';
        this.code = 'SYSTEM_IN_USE';
        this.systemId = systemId;
        this.credentialCount = credentialCount;
    }
}

/**
 * Error when system already exists
 */
export class DuplicateSystemError extends Error {
    constructor(systemId) {
        super(`System '${systemId}' already exists`);
        this.name = 'DuplicateSystemError';
        this.code = 'DUPLICATE_SYSTEM';
        this.systemId = systemId;
    }
}

/**
 * Check if string is valid kebab-case
 */
const isKebabCase = (str) => {
    return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(str);
};

/**
 * Create a new system configuration
 */
export const createSystemConfig = async (configData, performedBy) => {
    return prisma.$transaction(async (tx) => {
        // 1. Validate systemId format (kebab-case)
        if (!isKebabCase(configData.systemId)) {
            const error = new Error('systemId must be in kebab-case format (e.g., "corporate-vpn")');
            error.code = 'INVALID_SYSTEM_ID_FORMAT';
            throw error;
        }

        // 2. Check for duplicate systemId
        const existing = await repo.getSystemConfigById(configData.systemId, tx);
        if (existing) {
            throw new DuplicateSystemError(configData.systemId);
        }

        // 3. Validate LDAP field exists in schema
        const availableFields = await repo.getAvailableLdapFields(tx);
        if (!availableFields.includes(configData.usernameLdapField)) {
            throw new LdapFieldNotFoundError(configData.usernameLdapField, availableFields);
        }

        // 4. Create configuration
        const config = await repo.createSystemConfig({
            systemId: configData.systemId,
            usernameLdapField: configData.usernameLdapField,
            description: configData.description || null,
            isItOnly: configData.isItOnly || false
        }, tx);

        // 5. Create audit log
        await tx.auditLog.create({
            data: {
                action: 'system_config.create',
                actorUserId: performedBy,
                entityType: 'SystemConfig',
                entityId: config.systemId,
                metadata: {
                    usernameLdapField: config.usernameLdapField,
                    description: config.description,
                    isItOnly: config.isItOnly
                }
            }
        });

        return config;
    });
};

/**
 * Get all system configurations
 */
export const getSystemConfigs = async () => {
    return repo.getSystemConfigs();
};

/**
 * Get a single system configuration by ID
 */
export const getSystemConfig = async (systemId) => {
    return repo.getSystemConfigById(systemId);
};

/**
 * Update an existing system configuration
 */
export const updateSystemConfig = async (systemId, updates, performedBy) => {
    return prisma.$transaction(async (tx) => {
        // 1. Check if system exists
        const existing = await repo.getSystemConfigById(systemId, tx);
        if (!existing) {
            const error = new Error(`System '${systemId}' not found`);
            error.code = 'SYSTEM_NOT_FOUND';
            error.systemId = systemId;
            throw error;
        }

        // 2. Validate LDAP field if being updated
        if (updates.usernameLdapField) {
            const availableFields = await repo.getAvailableLdapFields(tx);
            if (!availableFields.includes(updates.usernameLdapField)) {
                throw new LdapFieldNotFoundError(updates.usernameLdapField, availableFields);
            }
        }

        // 3. Track changes for audit log
        const changes = {};
        if (updates.usernameLdapField && updates.usernameLdapField !== existing.usernameLdapField) {
            changes.usernameLdapField = {
                old: existing.usernameLdapField,
                new: updates.usernameLdapField
            };
        }
        if (updates.description !== undefined && updates.description !== existing.description) {
            changes.description = {
                old: existing.description,
                new: updates.description
            };
        }
        if (updates.isItOnly !== undefined && updates.isItOnly !== existing.isItOnly) {
            changes.isItOnly = {
                old: existing.isItOnly,
                new: updates.isItOnly
            };
        }

        // 4. Update configuration
        const config = await repo.updateSystemConfig(systemId, {
            ...(updates.usernameLdapField && { usernameLdapField: updates.usernameLdapField }),
            ...(updates.description !== undefined && { description: updates.description }),
            ...(updates.isItOnly !== undefined && { isItOnly: updates.isItOnly })
        }, tx);

        // 5. Create audit log if there were changes
        if (Object.keys(changes).length > 0) {
            await tx.auditLog.create({
                data: {
                    action: 'system_config.update',
                    actorUserId: performedBy,
                    entityType: 'SystemConfig',
                    entityId: systemId,
                    metadata: { changes }
                }
            });
        }

        return config;
    });
};

/**
 * Delete a system configuration (only if not in use)
 */
export const deleteSystemConfig = async (systemId, performedBy) => {
    return prisma.$transaction(async (tx) => {
        // 1. Check if system exists
        const existing = await repo.getSystemConfigById(systemId, tx);
        if (!existing) {
            const error = new Error(`System '${systemId}' not found`);
            error.code = 'SYSTEM_NOT_FOUND';
            error.systemId = systemId;
            throw error;
        }

        // 2. Check if system is in use
        const usageCount = await repo.getCredentialCountForSystem(systemId, tx);
        if (usageCount > 0) {
            throw new SystemInUseError(systemId, usageCount);
        }

        // 3. Delete configuration
        await repo.deleteSystemConfig(systemId, tx);

        // 4. Create audit log
        await tx.auditLog.create({
            data: {
                action: 'system_config.delete',
                actorUserId: performedBy,
                entityType: 'SystemConfig',
                entityId: systemId,
                metadata: {
                    deletedSystem: {
                        systemId: existing.systemId,
                        usernameLdapField: existing.usernameLdapField,
                        description: existing.description
                    }
                }
            }
        });

        return { success: true, systemId };
    });
};

/**
 * Get available LDAP fields from user data
 */
export const getAvailableLdapFields = async () => {
    return repo.getAvailableLdapFields();
};
