import * as repo from "./repo.js";
import { prisma } from "../../shared/db/prisma.js";
import { generateCredentials, previewCredentials, MissingLdapFieldsError, NoActiveTemplateError } from "./generator.js";

/**
 * Error for disabled user blocking regeneration
 */
export class DisabledUserError extends Error {
    constructor(userId) {
        super('Cannot regenerate credentials for disabled users');
        this.name = 'DisabledUserError';
        this.code = 'DISABLED_USER';
        this.userId = userId;
    }
}

/**
 * Error when no changes detected
 */
export class NoChangesDetectedError extends Error {
    constructor(userId, lastGeneratedAt) {
        super('No changes detected since last credential generation');
        this.name = 'NoChangesDetectedError';
        this.code = 'NO_CHANGES_DETECTED';
        this.userId = userId;
        this.lastGeneratedAt = lastGeneratedAt;
    }
}

export const createTemplate = async (userId, data) => {
    return prisma.$transaction(async (tx) => {
        const isActive = data.isActive !== false; // Default true

        if (isActive) {
            await repo.deactivateAllTemplates(tx);
        }

        return repo.createCredentialTemplate({
            ...data,
            isActive,
            version: 1,
            createdBy: userId
        }, tx);
    });
};

export const updateTemplate = async (userId, id, data) => {
    return prisma.$transaction(async (tx) => {
        const existing = await repo.getCredentialTemplateById(id, tx);
        if (!existing) return null;

        const isActive = data.isActive !== undefined ? data.isActive : existing.isActive;

        if (isActive && (data.isActive === true || !existing.isActive)) {
            await repo.deactivateAllTemplates(tx);
        }

        const updateData = {
            ...data,
            version: existing.version + 1
        };

        return repo.updateCredentialTemplate(id, updateData, tx);
    });
};

export const listTemplates = async () => {
    return repo.getCredentialTemplates();
};

export const getTemplate = async (id) => {
    return repo.getCredentialTemplateById(id);
};

export const getActiveTemplate = async () => {
    return repo.getActiveCredentialTemplate();
};

// Credential Generation Services

export const previewUserCredentials = async (userId) => {
    const [template, user] = await Promise.all([
        repo.getActiveCredentialTemplate(),
        repo.getUserById(userId)
    ]);

    if (!user) {
        throw new Error('User not found');
    }

    return previewCredentials(template, user);
};

export const generateUserCredentials = async (generatedByUserId, targetUserId) => {
    return prisma.$transaction(async (tx) => {
        // Get active template and target user
        const [template, user] = await Promise.all([
            repo.getActiveCredentialTemplate(tx),
            repo.getUserById(targetUserId, tx)
        ]);

        if (!user) {
            throw new Error('User not found');
        }

        // Generate credentials
        let credentials;
        try {
            credentials = generateCredentials(template, user);
        } catch (error) {
            if (error instanceof MissingLdapFieldsError) {
                // Re-throw as structured error for API handling
                const problemDetails = {
                    type: '/problems/credential-generation-failed',
                    title: 'Credential Generation Failed',
                    status: 422,
                    detail: error.message,
                    missingFields: error.missingFields,
                    userId: targetUserId,
                    system: error.system
                };
                throw Object.assign(new Error(error.message), { 
                    code: 'MISSING_LDAP_FIELDS', 
                    problemDetails 
                });
            }
            throw error;
        }

        // Deactivate existing credentials for the user
        await repo.deactivateUserCredentials(targetUserId, tx);

        // Create new credentials for each system
        const createdCredentials = [];
        for (const cred of credentials) {
            const created = await repo.createUserCredential({
                userId: targetUserId,
                system: cred.system,
                username: cred.username,
                password: cred.password,
                templateVersion: cred.templateVersion,
                generatedBy: generatedByUserId
            }, tx);

            // Create initial version record
            await repo.createCredentialVersion({
                credentialId: created.id,
                username: cred.username,
                password: cred.password,
                reason: 'initial',
                createdBy: generatedByUserId
            }, tx);

            createdCredentials.push(created);
        }

        return {
            userId: targetUserId,
            credentials: createdCredentials,
            templateVersion: template.version
        };
    });
};

export const listUserCredentials = async (userId) => {
    return repo.getUserCredentials(userId);
};

export const getUserCredential = async (credentialId) => {
    return repo.getUserCredentialById(credentialId);
};

export const getCredentialVersionHistory = async (credentialId) => {
    return repo.getCredentialVersions(credentialId);
};

// Preview Session Management

export const storePreviewSession = async (userId, preview) => {
    const token = `preview_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    const sessionData = {
        userId,
        credentials: preview.credentials,
        templateVersion: preview.templateVersion,
        generatedAt: new Date().toISOString()
    };
    
    await repo.storePreviewSession(token, sessionData);
    return token;
};

export const getPreviewSession = async (token) => {
    return repo.getPreviewSession(token);
};

export const deletePreviewSession = async (token) => {
    return repo.deletePreviewSession(token);
};

// Save credentials from preview session

export const savePreviewedCredentials = async (generatedByUserId, previewSession) => {
    return prisma.$transaction(async (tx) => {
        const { userId, credentials, templateVersion } = previewSession;
        
        // Deactivate existing credentials for the user
        await repo.deactivateUserCredentials(userId, tx);
        
        // Create new credentials for each system
        const createdCredentials = [];
        for (const cred of credentials) {
            const created = await repo.createUserCredential({
                userId: userId,
                system: cred.system,
                username: cred.username,
                password: cred.password,
                templateVersion: cred.templateVersion || templateVersion,
                generatedBy: generatedByUserId
            }, tx);
            
            // Create initial version record
            await repo.createCredentialVersion({
                credentialId: created.id,
                username: cred.username,
                password: cred.password,
                reason: 'initial',
                createdBy: generatedByUserId
            }, tx);
            
            createdCredentials.push(created);
        }
        
        return {
            userId,
            credentials: createdCredentials,
            templateVersion
        };
    });
};

// Credential Regeneration Services (Story 2.4)

/**
 * Detect changes between current state and stored credentials
 * @param {Object} user - User with LDAP attributes
 * @param {Array} existingCredentials - Current active credentials
 * @param {Object} template - Active credential template
 * @returns {Object} - Change detection result
 */
export const detectChanges = (user, existingCredentials, template) => {
    const ldapAttributes = user.ldapAttributes || {};
    const changes = {
        ldapChanged: false,
        templateChanged: false,
        changedLdapFields: [],
        oldTemplateVersion: null,
        newTemplateVersion: template?.version
    };

    if (!existingCredentials || existingCredentials.length === 0) {
        // No existing credentials - treat as new
        changes.ldapChanged = true;
        return changes;
    }

    // Check template version change
    const firstCred = existingCredentials[0];
    changes.oldTemplateVersion = firstCred.templateVersion;
    if (firstCred.templateVersion !== template?.version) {
        changes.templateChanged = true;
    }

    // Check LDAP field changes - compare stored ldapSources with current values
    for (const cred of existingCredentials) {
        if (cred.ldapSources) {
            for (const [field, ldapSource] of Object.entries(cred.ldapSources)) {
                if (ldapAttributes[ldapSource] !== undefined) {
                    const currentValue = ldapAttributes[ldapSource];
                    // For now, assume change if we have the field
                    // More sophisticated comparison could be added
                    if (!changes.changedLdapFields.includes(ldapSource)) {
                        changes.changedLdapFields.push(ldapSource);
                    }
                }
            }
        }
    }

    // Consider LDAP changed if we have any changed fields
    changes.ldapChanged = changes.changedLdapFields.length > 0;

    return changes;
};

/**
 * Build comparison between old and new credentials
 * @param {Array} oldCredentials - Existing active credentials
 * @param {Array} newCredentials - Newly generated credentials
 * @param {Object} changes - Change detection result
 * @returns {Array} - Comparison array
 */
export const buildCredentialComparison = (oldCredentials, newCredentials, changes) => {
    const comparisons = [];
    const oldBySystem = new Map(oldCredentials.map(c => [c.system, c]));
    const newBySystem = new Map(newCredentials.map(c => [c.system, c]));

    // Get all unique systems
    const allSystems = new Set([...oldBySystem.keys(), ...newBySystem.keys()]);

    for (const system of allSystems) {
        const old = oldBySystem.get(system);
        const new_ = newBySystem.get(system);

        const comparison = {
            system,
            old: old ? {
                username: old.username,
                password: old.password,
                isLocked: old.isLocked || false  // Future: Story 2.9
            } : null,
            new: new_ ? {
                username: new_.username,
                password: new_.password,
                isLocked: new_.isLocked || false  // Future: Story 2.9
            } : null,
            changes: [],
            skipped: false,
            skipReason: null
        };

        // Detect specific changes
        if (old && new_) {
            if (old.username !== new_.username) {
                comparison.changes.push('username');
            }
            if (old.password !== new_.password) {
                comparison.changes.push('password');
            }
        } else if (!old && new_) {
            comparison.changes.push('new_system');
        } else if (old && !new_) {
            comparison.changes.push('removed_system');
        }

        comparisons.push(comparison);
    }

    return comparisons;
};

/**
 * Preview credential regeneration with comparison
 * @param {string} userId - Target user ID
 * @returns {Object} - Preview result with comparison
 */
export const previewCredentialRegeneration = async (userId) => {
    const [template, user] = await Promise.all([
        repo.getActiveCredentialTemplate(),
        repo.getUserById(userId)
    ]);

    if (!user) {
        throw new Error('User not found');
    }

    // Check if user is disabled (FR19 guardrail)
    if (user.status === 'disabled') {
        throw new DisabledUserError(userId);
    }

    if (!template) {
        throw new NoActiveTemplateError();
    }

    // Get existing credentials
    const existingCredentials = await repo.getUserCredentials(userId);

    // Detect changes
    const changes = detectChanges(user, existingCredentials, template);

    // If no changes detected, throw error
    if (!changes.ldapChanged && !changes.templateChanged) {
        const lastGeneratedAt = existingCredentials.length > 0 
            ? existingCredentials[0].generatedAt 
            : null;
        throw new NoChangesDetectedError(userId, lastGeneratedAt);
    }

    // Generate new credentials
    let newCredentials;
    try {
        newCredentials = generateCredentials(template, user);
    } catch (error) {
        if (error instanceof MissingLdapFieldsError) {
            const problemDetails = {
                type: '/problems/credential-generation-failed',
                title: 'Credential Generation Failed',
                status: 422,
                detail: error.message,
                missingFields: error.missingFields,
                userId: userId,
                system: error.system
            };
            throw Object.assign(new Error(error.message), { 
                code: 'MISSING_LDAP_FIELDS', 
                problemDetails 
            });
        }
        throw error;
    }

    // Build comparison
    const comparisons = buildCredentialComparison(existingCredentials, newCredentials, changes);

    // Determine change type
    let changeType = 'ldap_update';
    if (changes.templateChanged && changes.ldapChanged) {
        changeType = 'both';
    } else if (changes.templateChanged) {
        changeType = 'template_change';
    }

    return {
        success: true,
        userId,
        changeType,
        changedLdapFields: changes.changedLdapFields,
        oldTemplateVersion: changes.oldTemplateVersion,
        newTemplateVersion: changes.newTemplateVersion,
        comparisons,
        newCredentials,
        existingCredentials: existingCredentials.map(c => ({
            id: c.id,
            system: c.system,
            username: c.username,
            password: c.password,
            templateVersion: c.templateVersion
        }))
    };
};

/**
 * Store regeneration preview session
 * @param {string} userId - User ID
 * @param {Object} preview - Regeneration preview data
 * @returns {string} - Preview token
 */
export const storeRegenerationPreview = async (userId, preview) => {
    const token = `regen_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    const sessionData = {
        type: 'regeneration',
        userId,
        changeType: preview.changeType,
        changedLdapFields: preview.changedLdapFields,
        oldTemplateVersion: preview.oldTemplateVersion,
        newTemplateVersion: preview.newTemplateVersion,
        comparisons: preview.comparisons,
        newCredentials: preview.newCredentials,
        existingCredentialIds: preview.existingCredentials.map(c => c.id),
        generatedAt: new Date().toISOString()
    };
    
    await repo.storePreviewSession(token, sessionData);
    return token;
};

/**
 * Confirm and execute credential regeneration
 * @param {string} performedByUserId - IT staff performing the regeneration
 * @param {Object} previewSession - Stored preview session
 * @returns {Object} - Regeneration result
 */
export const confirmRegeneration = async (performedByUserId, previewSession) => {
    return prisma.$transaction(async (tx) => {
        const { 
            userId, 
            newCredentials, 
            existingCredentialIds, 
            changeType,
            comparisons 
        } = previewSession;

        // Get user to verify not disabled
        const user = await repo.getUserById(userId, tx);
        if (!user) {
            throw new Error('User not found');
        }
        if (user.status === 'disabled') {
            throw new DisabledUserError(userId);
        }

        const regeneratedCredentials = [];
        const preservedHistory = [];
        const skippedCredentials = [];

        // Process each comparison
        for (const comparison of comparisons) {
            // Skip locked credentials (preparation for Story 2.9)
            if (comparison.skipped) {
                skippedCredentials.push({
                    system: comparison.system,
                    reason: comparison.skipReason
                });
                continue;
            }

            const newCred = previewSession.newCredentials.find(c => c.system === comparison.system);
            
            if (!newCred) {
                continue; // No new credential for this system
            }

            // Find existing credential for this system
            const existingCred = comparison.old ? 
                await repo.getUserCredentialBySystem(userId, comparison.system, tx) : 
                null;

            if (existingCred) {
                // Create history record before deactivating
                await repo.createCredentialVersion({
                    credentialId: existingCred.id,
                    username: existingCred.username,
                    password: existingCred.password,
                    reason: 'regeneration',
                    createdBy: performedByUserId
                }, tx);

                preservedHistory.push({
                    system: comparison.system,
                    previousUsername: existingCred.username,
                    previousVersion: existingCred.templateVersion
                });

                // Deactivate old credential
                await repo.deactivateUserCredential(existingCred.id, tx);
            }

            // Create new credential
            const created = await repo.createUserCredential({
                userId: userId,
                system: newCred.system,
                username: newCred.username,
                password: newCred.password,
                templateVersion: previewSession.newTemplateVersion,
                generatedBy: performedByUserId
            }, tx);

            // Create version record for new credential
            await repo.createCredentialVersion({
                credentialId: created.id,
                username: newCred.username,
                password: newCred.password,
                reason: 'regeneration',
                createdBy: performedByUserId
            }, tx);

            regeneratedCredentials.push({
                id: created.id,
                system: newCred.system,
                username: newCred.username,
                templateVersion: previewSession.newTemplateVersion
            });
        }

        return {
            userId,
            changeType,
            regeneratedCredentials,
            preservedHistory,
            skippedCredentials,
            templateVersion: previewSession.newTemplateVersion,
            performedBy: performedByUserId,
            performedAt: new Date().toISOString()
        };
    });
};
