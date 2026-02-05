import * as repo from "./repo.js";
import * as systemConfigRepo from "../system-configs/repo.js";
import * as userRepo from "../users/repo.js";
import { createAuditLog } from "../audit/repo.js";
import { prisma } from "../../shared/db/prisma.js";
import { generateCredentials, previewCredentials, MissingLdapFieldsError, NoActiveTemplateError } from "./generator.js";
import * as normalizationRuleService from "../normalization-rules/service.js";

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

export class CredentialNotFoundError extends Error {
    constructor(userId, systemId) {
        super(`No credential found for user ${userId} on system ${systemId}`);
        this.name = 'CredentialNotFoundError';
        this.code = 'CREDENTIAL_NOT_FOUND';
        this.userId = userId;
        this.systemId = systemId;
    }
}

export class CredentialAlreadyLockedError extends Error {
    constructor(userId, systemId) {
        super(`Credential for user ${userId} on system ${systemId} is already locked`);
        this.name = 'CredentialAlreadyLockedError';
        this.code = 'CREDENTIAL_ALREADY_LOCKED';
        this.userId = userId;
        this.systemId = systemId;
    }
}

export class CredentialNotLockedError extends Error {
    constructor(userId, systemId) {
        super(`Credential for user ${userId} on system ${systemId} is not locked`);
        this.name = 'CredentialNotLockedError';
        this.code = 'CREDENTIAL_NOT_LOCKED';
        this.userId = userId;
        this.systemId = systemId;
    }
}

export class CredentialsLockedError extends Error {
    constructor(lockedCredentials = []) {
        super('Some credentials are locked and cannot be regenerated');
        this.name = 'CredentialsLockedError';
        this.code = 'CREDENTIALS_LOCKED';
        this.lockedCredentials = lockedCredentials;
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

export const previewUserCredentials = async (userId, systemId = null) => {
    const [template, user] = await Promise.all([
        repo.getActiveCredentialTemplate(),
        repo.getUserById(userId)
    ]);

    if (!user) {
        throw new Error('User not found');
    }

    // Look up system configuration if systemId provided
    let systemConfig = null;
    let generationMetadata = {
        systemId: systemId,
        usernameFieldUsed: null,
        isFallback: false,
        normalizationRulesApplied: []
    };

    if (systemId) {
        systemConfig = await systemConfigRepo.getSystemConfigById(systemId);
        generationMetadata.systemId = systemId;

        // If system config found, extract username using configured field
        if (systemConfig) {
            const ldapAttributes = user.ldapAttributes || {};
            const extractionResult = extractUsernameWithConfig(ldapAttributes, systemConfig, systemId);

            generationMetadata.usernameFieldUsed = extractionResult.usernameFieldUsed;
            generationMetadata.isFallback = extractionResult.isFallback;

            // Apply normalization
            const normResult = await normalizationRuleService.applyNormalizationRules(extractionResult.username, systemId);
            generationMetadata.normalizationRulesApplied = normResult.rulesApplied;

            // Attach system config info to user for generator
            user._systemConfig = {
                systemId,
                usernameLdapField: extractionResult.usernameFieldUsed,
                fallback: extractionResult.isFallback,
                rawUsername: extractionResult.username,
                normalizedUsername: normResult.normalized
            };
        } else {
            console.warn(`[Preview Credentials] No system config found for '${systemId}'. Falling back to 'mail' field.`);
            generationMetadata.usernameFieldUsed = 'mail';
            generationMetadata.isFallback = true;
        }
    }

    const preview = previewCredentials(template, user, systemConfig);

    // If no specific system requested, ensure all systems get normalization rules applied
    if (!systemId && preview.success) {
        await enrichUserWithNormalization(user, template);
        // Re-generate with enriched user to get normalized usernames for all
        const enrichedPreview = previewCredentials(template, user);
        return enrichedPreview;
    }

    // Add metadata to preview if systemId was specified
    if (systemId && preview.success) {
        preview.metadata = generationMetadata;
    }

    return preview;
};

/**
 * Extract username from LDAP attributes using system configuration
 * @param {Object} ldapAttributes - User's LDAP attributes
 * @param {Object} systemConfig - System configuration with usernameLdapField
 * @param {string} systemId - System identifier for logging
 * @returns {Object} - Object containing username, field used, and fallback status
 */
const extractUsernameWithConfig = (ldapAttributes, systemConfig, systemId) => {
    const ldapData = ldapAttributes || {};
    let username;
    let usernameFieldUsed;
    let isFallback = false;

    if (systemConfig && systemConfig.usernameLdapField) {
        // Use configured LDAP field from system config
        usernameFieldUsed = systemConfig.usernameLdapField;
        username = ldapData[usernameFieldUsed];
    }

    // Fallback to 'mail' field if no system config or configured field not available
    if (!username) {
        if (systemConfig) {
            console.warn(`[Credential Generation] Configured field '${systemConfig.usernameLdapField}' not found in LDAP data for system '${systemId}'. Falling back to 'mail' field.`);
        } else {
            console.warn(`[Credential Generation] No system config found for '${systemId}'. Falling back to 'mail' field.`);
        }
        usernameFieldUsed = 'mail';
        username = ldapData.mail;
        isFallback = true;
    }

    // If still no username, try to generate from first/last name as last resort
    if (!username && ldapData.givenName && ldapData.sn) {
        username = `${ldapData.givenName.toLowerCase()}.${ldapData.sn.toLowerCase()}`;
        usernameFieldUsed = 'givenName+sn';
        isFallback = true;
    }

    return {
        username,
        usernameFieldUsed,
        isFallback
    };
};

/**
 * Enrich user object with per-system normalization data for all systems in template
 */
const enrichUserWithNormalization = async (user, template, tx = prisma) => {
    if (!template?.structure?.systems) return;

    user._systemConfigs = {};
    const configs = await systemConfigRepo.getSystemConfigs(tx);
    const configMap = new Map(configs.map(c => [c.systemId, c]));

    for (const system of template.structure.systems) {
        const systemId = system.name || system;
        const config = configMap.get(systemId);
        const ldapAttributes = user.ldapAttributes || {};

        const extraction = extractUsernameWithConfig(ldapAttributes, config, systemId);

        try {
            const normResult = await normalizationRuleService.applyNormalizationRules(extraction.username, systemId);

            user._systemConfigs[systemId] = {
                systemId,
                usernameLdapField: extraction.usernameFieldUsed,
                fallback: extraction.isFallback,
                rawUsername: extraction.username,
                normalizedUsername: normResult.normalized,
                normalizationRulesApplied: normResult.rulesApplied
            };
        } catch (normError) {
            console.error(`[Normalization] Failed for system ${systemId}:`, normError);
            // Fallback to extraction if normalization fails (should not happen if validation works)
            user._systemConfigs[systemId] = {
                systemId,
                usernameLdapField: extraction.usernameFieldUsed,
                fallback: extraction.isFallback,
                rawUsername: extraction.username,
                normalizedUsername: extraction.username,
                normalizationRulesApplied: []
            };
        }
    }
};


export const generateUserCredentials = async (generatedByUserId, targetUserId, systemId = null) => {
    return prisma.$transaction(async (tx) => {
        // Get active template and target user
        const [template, user] = await Promise.all([
            repo.getActiveCredentialTemplate(tx),
            repo.getUserById(targetUserId, tx)
        ]);

        if (!user) {
            throw new Error('User not found');
        }

        // Check if user is disabled
        if (userRepo.isUserDisabled(user)) {
            throw new DisabledUserError(targetUserId);
        }

        // Look up system configuration if systemId provided
        let systemConfig = null;
        let generationMetadata = {
            systemId: systemId,
            usernameFieldUsed: null,
            isFallback: false,
            normalizationRulesApplied: []
        };

        if (systemId) {
            systemConfig = await systemConfigRepo.getSystemConfigById(systemId, tx);
            generationMetadata.systemId = systemId;
        }

        // If specific system requested, extract username using system config
        if (systemId && systemConfig) {
            const ldapAttributes = user.ldapAttributes || {};
            const extractionResult = extractUsernameWithConfig(ldapAttributes, systemConfig, systemId);

            generationMetadata.usernameFieldUsed = extractionResult.usernameFieldUsed;
            generationMetadata.isFallback = extractionResult.isFallback;

            // Apply normalization
            const normResult = await normalizationRuleService.applyNormalizationRules(extractionResult.username, systemId);
            generationMetadata.normalizationRulesApplied = normResult.rulesApplied;

            // Pass system config to generator for username extraction
            user._systemConfig = {
                systemId,
                usernameLdapField: extractionResult.usernameFieldUsed,
                fallback: extractionResult.isFallback,
                rawUsername: extractionResult.username,
                normalizedUsername: normResult.normalized,
                normalizationRulesApplied: normResult.rulesApplied
            };
        } else if (!systemId) {
            // Apply normalization for all systems
            await enrichUserWithNormalization(user, template, tx);
        }

        // Generate credentials
        let credentials;
        try {
            credentials = generateCredentials(template, user, systemConfig);
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
                    system: error.system,
                    metadata: generationMetadata
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
            console.log("Creating UserCredential:", { userId: targetUserId, system: cred.system });
            const created = await repo.createUserCredential({
                userId: targetUserId,
                systemId: cred.system,
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

            createdCredentials.push({
                ...created,
                generationMetadata: cred.system === systemId ? generationMetadata : null
            });
        }

        return {
            userId: targetUserId,
            credentials: createdCredentials,
            templateVersion: template.version,
            metadata: systemId ? generationMetadata : undefined
        };
    });
};

export const listUserCredentials = async (userId, includeItOnly = false) => {
    return repo.getUserCredentials(userId, includeItOnly);
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
                userId: userId,
                system: cred.system,
                username: cred.username,
                password: cred.password,
                templateVersion: cred.templateVersion || templateVersion,
                isActive: true,
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
export const buildCredentialComparison = (oldCredentials, newCredentials, changes, lockedMap = new Map()) => {
    const comparisons = [];
    const oldBySystem = new Map(oldCredentials.map(c => [c.systemId || c.system, c]));
    const newBySystem = new Map(newCredentials.map(c => [c.system || c.systemId, c]));

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
            skipped: lockedMap.has(system) && lockedMap.get(system).isLocked,
            skipReason: (lockedMap.has(system) && lockedMap.get(system).isLocked) ? 'Credential is locked' : null
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
 * @param {string} systemId - Optional system ID for system-specific generation
 * @returns {Object} - Preview result with comparison
 */
export const previewCredentialRegeneration = async (userId, systemId = null) => {
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

    // Get locked credentials to check for skips (Story 2.9)
    const lockedCredentials = await repo.getLockedCredentials({ userId });
    const lockedMap = new Map(lockedCredentials.data.map(l => [l.systemId, l]));
    const lockedByMap = await getLockedByMap(lockedCredentials.data);
    const lockedCredentialSummaries = lockedCredentials.data.map(lock =>
        buildLockedCredentialSummary(lock, lockedByMap)
    );

    // Detect changes
    const changes = detectChanges(user, existingCredentials, template);

    // If no changes detected, throw error
    if (!changes.ldapChanged && !changes.templateChanged) {
        const lastGeneratedAt = existingCredentials.length > 0
            ? existingCredentials[0].generatedAt
            : null;
        throw new NoChangesDetectedError(userId, lastGeneratedAt);
    }

    // Look up system configuration if systemId provided
    let systemConfig = null;
    let generationMetadata = {
        systemId: systemId,
        usernameFieldUsed: null,
        isFallback: false,
        normalizationRulesApplied: []
    };

    if (systemId) {
        systemConfig = await systemConfigRepo.getSystemConfigById(systemId);
        generationMetadata.systemId = systemId;

        // If system config found, extract username using configured field
        if (systemConfig) {
            const ldapAttributes = user.ldapAttributes || {};
            const extractionResult = extractUsernameWithConfig(ldapAttributes, systemConfig, systemId);

            generationMetadata.usernameFieldUsed = extractionResult.usernameFieldUsed;
            generationMetadata.isFallback = extractionResult.isFallback;

            // Apply normalization
            const normResult = await normalizationRuleService.applyNormalizationRules(extractionResult.username, systemId);
            generationMetadata.normalizationRulesApplied = normResult.rulesApplied;

            // Attach system config info to user for generator
            user._systemConfig = {
                systemId,
                usernameLdapField: extractionResult.usernameFieldUsed,
                fallback: extractionResult.isFallback,
                rawUsername: extractionResult.username,
                normalizedUsername: normResult.normalized
            };
        } else {
            console.warn(`[Regeneration] No system config found for '${systemId}'. Falling back to 'mail' field.`);
            generationMetadata.usernameFieldUsed = 'mail';
            generationMetadata.isFallback = true;
        }
    }

    // Generate new credentials
    let newCredentials;
    try {
        if (!systemId) {
            await enrichUserWithNormalization(user, template);
        }
        newCredentials = generateCredentials(template, user, systemConfig);
    } catch (error) {
        if (error instanceof MissingLdapFieldsError) {
            const problemDetails = {
                type: '/problems/credential-generation-failed',
                title: 'Credential Generation Failed',
                status: 422,
                detail: error.message,
                missingFields: error.missingFields,
                userId: userId,
                system: error.system,
                metadata: generationMetadata
            };
            throw Object.assign(new Error(error.message), {
                code: 'MISSING_LDAP_FIELDS',
                problemDetails
            });
        }
        throw error;
    }

    // Build comparison
    const comparisons = buildCredentialComparison(existingCredentials, newCredentials, changes, lockedMap);

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
        hasLockedCredentials: lockedCredentialSummaries.length > 0,
        lockedCredentials: lockedCredentialSummaries,
        newCredentials,
        existingCredentials: existingCredentials.map(c => ({
            id: c.id,
            system: c.system,
            username: c.username,
            password: c.password,
            templateVersion: c.templateVersion
        })),
        metadata: systemId ? generationMetadata : undefined
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
export const confirmRegeneration = async (performedByUserId, previewSession, options = {}) => {
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

        const { skipLocked = false, force = false } = options;
        const lockedSnapshot = await repo.getLockedCredentials({ userId }, tx);
        const lockedByMap = await getLockedByMap(lockedSnapshot.data);
        const lockedCredentialSummaries = lockedSnapshot.data.map(lock =>
            buildLockedCredentialSummary(lock, lockedByMap)
        );
        const lockedMap = new Map(lockedSnapshot.data.map(lock => [lock.systemId, lock]));

        if (lockedCredentialSummaries.length > 0 && !force && !skipLocked) {
            throw new CredentialsLockedError(lockedCredentialSummaries);
        }

        const regeneratedCredentials = [];
        const preservedHistory = [];
        const skippedCredentials = [];

        // Process each comparison
        for (const comparison of comparisons) {
            const isLockedNow = lockedMap.has(comparison.system);
            if (isLockedNow && !force) {
                const locked = lockedMap.get(comparison.system);
                skippedCredentials.push({
                    system: comparison.system,
                    reason: 'Credential is locked',
                    lockedAt: toIsoString(locked?.lockedAt),
                    lockReason: locked?.lockReason || null
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

            // Race Condition Guard: Ensure the current credential matches what we previewed
            if (existingCred && previewSession.existingCredentialIds) {
                if (!previewSession.existingCredentialIds.includes(existingCred.id)) {
                    throw new Error(`Credential for system ${comparison.system} has changed since preview. Please regenerate.`);
                }
            }

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
                systemId: newCred.system,
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
                reason: 'initial',
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
            forced: force === true,
            performedBy: performedByUserId,
            performedAt: new Date().toISOString()
        };
    });
};

// Credential History Services (Story 2.5)

/**
 * Get credential history for a user with filtering and pagination
 * @param {string} userId - User ID to get history for
 * @param {Object} filters - Filter options (system, startDate, endDate, page, limit)
 * @returns {Object} - History with pagination metadata
 */
export const getCredentialHistory = async (userId, filters = {}) => {
    const history = await repo.getCredentialHistoryByUser(userId, filters);
    return history;
};

/**
 * Get single credential version details
 * @param {string} versionId - Version ID
 * @returns {Object} - Version details
 */
export const getCredentialVersion = async (versionId) => {
    const version = await repo.getCredentialVersionById(versionId);
    return version;
};

/**
 * Compare two credential versions
 * @param {string} versionId1 - First version ID
 * @param {string} versionId2 - Second version ID
 * @returns {Object} - Comparison result with differences
 */
export const compareCredentialVersions = async (versionId1, versionId2) => {
    const versions = await repo.getCredentialVersionsForComparison([versionId1, versionId2]);

    if (versions.length !== 2) {
        throw new Error('One or both version IDs not found');
    }

    const version1 = versions.find(v => v.id === versionId1);
    const version2 = versions.find(v => v.id === versionId2);

    // Validate same system
    if (version1.system !== version2.system) {
        const error = new Error('Cannot compare versions from different systems');
        error.code = 'DIFFERENT_SYSTEMS';
        error.system1 = version1.system;
        error.system2 = version2.system;
        throw error;
    }

    // Build differences array
    const differences = [];

    if (version1.username !== version2.username) {
        differences.push({
            field: 'username',
            oldValue: version1.username,
            newValue: version2.username
        });
    }

    if (version1.password !== version2.password) {
        differences.push({
            field: 'password',
            changed: true,
            note: 'Password was changed'
        });
    }

    if (version1.templateVersion !== version2.templateVersion) {
        differences.push({
            field: 'templateVersion',
            oldValue: version1.templateVersion,
            newValue: version2.templateVersion
        });
    }

    // Calculate time gap with precise formatting
    const timeDiff = new Date(version2.createdAt) - new Date(version1.createdAt);
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

    let timeGap;
    if (days > 0) {
        timeGap = `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
        timeGap = `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (minutes > 0) {
        timeGap = `${minutes} minute${minutes !== 1 ? 's' : ''}, ${seconds} second${seconds !== 1 ? 's' : ''}`;
    } else {
        timeGap = `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }

    return {
        version1: formatHistoryEntry(version1),
        version2: formatHistoryEntry(version2),
        differences,
        system: version1.system,
        timeGap
    };
};

/**
 * Format a history entry for API response
 * @param {Object} version - Raw version from database
 * @returns {Object} - Formatted entry
 */
const formatHistoryEntry = (version) => {
    const reasonLabels = {
        'initial': 'Initial Generation',
        'regeneration': 'Regenerated',
        'ldap_update': 'LDAP Update',
        'template_change': 'Template Change',
        'override': 'Manual Override'
    };

    return {
        id: version.id,
        userId: version.userId,
        system: version.system,
        username: version.username,
        password: {
            masked: '••••••••',
            revealed: null // Only populated on explicit reveal
        },
        reason: version.reason,
        reasonLabel: reasonLabels[version.reason] || version.reason,
        timestamp: version.createdAt.toISOString(),
        createdBy: version.createdByUser ? {
            id: version.createdByUser.id,
            name: version.createdByUser.username
        } : null,
        templateVersion: version.templateVersion,
        ldapFields: version.ldapSources ? Object.keys(version.ldapSources) : [],
        isCurrent: version.isActive
    };
};

/**
 * Reveal password for a credential version (with audit logging)
 * @param {string} versionId - Version ID
 * @param {string} actorUserId - User performing the reveal
 * @returns {Object} - Version with revealed password
 */
export const revealCredentialPassword = async (versionId, actorUserId) => {
    const version = await repo.getCredentialVersionById(versionId);

    if (!version) {
        const error = new Error('Version not found');
        error.code = 'VERSION_NOT_FOUND';
        error.versionId = versionId;
        throw error;
    }

    // Return formatted entry with revealed password
    return {
        ...formatHistoryEntry(version),
        password: {
            masked: '••••••••',
            revealed: version.password
        }
    };
};

// Credential Override Services (Story 2.6)

/**
 * Preview credential override changes
 * @param {string} userId - Target user ID
 * @param {string} system - Credential system (e.g., 'email', 'vpn')
 * @param {Object} overrideData - Override data containing username, password, reason
 * @returns {Object} - Preview result with comparison
 */
export const previewCredentialOverride = async (userId, system, overrideData) => {
    // 1. Check user exists and is enabled
    const user = await repo.getUserById(userId);
    if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        error.userId = userId;
        throw error;
    }

    if (user.status === 'disabled') {
        throw new DisabledUserError(userId);
    }

    // 2. Get active credential for this system
    const credential = await repo.getUserCredentialBySystem(userId, system);
    if (!credential) {
        const error = new Error('No active credential for system');
        error.code = 'NO_ACTIVE_CREDENTIAL';
        error.userId = userId;
        error.system = system;
        throw error;
    }

    // 3. Build preview with partial override logic
    const proposedCredential = {
        system,
        username: overrideData.username || credential.username,
        password: overrideData.password || credential.password
    };

    const changes = {
        usernameChanged: overrideData.username && overrideData.username !== credential.username,
        passwordChanged: !!overrideData.password
    };

    // 4. Build preview object
    const preview = {
        type: 'override',
        userId,
        system,
        currentCredential: {
            id: credential.id,
            system: credential.system,
            username: credential.username,
            password: {
                masked: '••••••••'
            },
            templateVersion: credential.templateVersion
        },
        proposedCredential: {
            system,
            username: proposedCredential.username,
            password: {
                masked: '••••••••'
            }
        },
        changes,
        reason: overrideData.reason,
        timestamp: new Date().toISOString()
    };

    // 5. Store preview session
    const token = await storeOverridePreview(userId, system, preview);

    return {
        previewToken: token,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
        ...preview
    };
};

/**
 * Store override preview session
 * @param {string} userId - User ID
 * @param {string} system - System being overridden
 * @param {Object} preview - Override preview data
 * @returns {string} - Preview token
 */
export const storeOverridePreview = async (userId, system, preview) => {
    const token = `override_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    const sessionData = {
        type: 'override',
        userId,
        system,
        proposedCredential: preview.proposedCredential,
        currentCredential: preview.currentCredential,
        changes: preview.changes,
        reason: preview.reason,
        createdAt: new Date().toISOString()
    };

    await repo.storePreviewSession(token, sessionData);
    return token;
};

/**
 * Confirm and execute credential override
 * @param {string} performedByUserId - IT staff performing the override
 * @param {Object} previewSession - Stored preview session
 * @returns {Object} - Override result
 */
export const confirmCredentialOverride = async (performedByUserId, previewSession) => {
    return prisma.$transaction(async (tx) => {
        const {
            userId,
            system,
            proposedCredential,
            currentCredential,
            reason
        } = previewSession;

        // 1. Re-validate user is still enabled
        const user = await repo.getUserById(userId, tx);
        if (!user) {
            const error = new Error('User not found');
            error.code = 'USER_NOT_FOUND';
            error.userId = userId;
            throw error;
        }

        if (user.status === 'disabled') {
            throw new DisabledUserError(userId);
        }

        // 2. Create history record for current credential before deactivating
        await repo.createCredentialVersion({
            credentialId: currentCredential.id,
            userId: userId,
            system: system,
            username: currentCredential.username,
            password: currentCredential.password, // Note: This should come from actual DB record
            templateVersion: currentCredential.templateVersion,
            isActive: false,
            reason: 'override',
            createdBy: performedByUserId
        }, tx);

        // 3. Deactivate current credential
        await repo.deactivateUserCredential(currentCredential.id, tx);

        // 4. Create new credential with override values
        // Note: We need to get the actual password from previewSession since currentCredential only has masked
        const created = await repo.createUserCredential({
            userId: userId,
            system: system,
            username: proposedCredential.username,
            password: proposedCredential.password, // This comes from preview session
            templateVersion: currentCredential.templateVersion, // Keep same template version
            generatedBy: performedByUserId
        }, tx);

        // 5. Create version record for new credential
        const newVersion = await repo.createCredentialVersion({
            credentialId: created.id,
            userId: userId,
            system: system,
            username: proposedCredential.username,
            password: proposedCredential.password,
            templateVersion: currentCredential.templateVersion,
            isActive: true,
            reason: 'override',
            createdBy: performedByUserId
        }, tx);

        // 6. Create audit log entry
        await tx.auditLog.create({
            data: {
                action: 'credentials.override',
                actorUserId: performedByUserId,
                entityType: 'user_credential',
                entityId: created.id,
                metadata: {
                    targetUserId: userId,
                    system: system,
                    reason: reason,
                    usernameChanged: previewSession.changes?.usernameChanged || false,
                    passwordChanged: previewSession.changes?.passwordChanged || false
                }
            }
        });

        // 7. Delete preview session
        await repo.deletePreviewSession(previewSession.token || `override_${Date.now()}`);

        return {
            credentialId: created.id,
            system: system,
            overriddenAt: new Date().toISOString(),
            overriddenBy: {
                id: performedByUserId,
                username: user.username
            },
            historyVersionId: newVersion.id,
            changes: previewSession.changes || {
                usernameChanged: proposedCredential.username !== currentCredential.username,
                passwordChanged: !!proposedCredential.password
            }
        };
    });
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toIsoString = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const getLockedByMap = async (locks) => {
    const lockedByIds = [...new Set(locks.map(lock => lock.lockedBy).filter(Boolean))];
    if (lockedByIds.length === 0) {
        return new Map();
    }
    const users = await userRepo.findUsersByIds(lockedByIds);
    return new Map(users.map(user => [user.id, user]));
};

const buildLockedCredentialSummary = (lock, lockedByMap) => ({
    userId: lock.userId,
    systemId: lock.systemId,
    systemName: lock.system?.description || lock.systemId,
    lockedBy: lockedByMap.get(lock.lockedBy)?.username || lock.lockedBy,
    lockedAt: toIsoString(lock.lockedAt),
    lockReason: lock.lockReason || null
});

const calculateDaysLocked = (lockedAt) => {
    if (!lockedAt) return 0;
    const lockedAtMs = lockedAt instanceof Date ? lockedAt.getTime() : new Date(lockedAt).getTime();
    if (Number.isNaN(lockedAtMs)) return 0;
    return Math.max(0, Math.floor((Date.now() - lockedAtMs) / MS_PER_DAY));
};

// Credential Lock Services (Story 2.9)

export const lockCredential = async (userId, systemId, reason, performedBy) => {
    const credential = await repo.getUserCredentialBySystem(userId, systemId);
    if (!credential) {
        throw new CredentialNotFoundError(userId, systemId);
    }

    const existingLock = await repo.getLockRecord(userId, systemId);
    if (existingLock?.isLocked) {
        throw new CredentialAlreadyLockedError(userId, systemId);
    }

    const lock = await repo.upsertLockRecord({
        userId,
        systemId,
        isLocked: true,
        lockedBy: performedBy,
        lockedAt: new Date(),
        lockReason: reason || null,
        unlockedBy: null,
        unlockedAt: null
    });

    await createAuditLog({
        action: 'credential.lock',
        actorUserId: performedBy,
        entityType: 'credential',
        entityId: credential.id,
        metadata: { userId, systemId, reason: reason || null }
    });

    return lock;
};

export const unlockCredential = async (userId, systemId, performedBy) => {
    const lock = await repo.getLockRecord(userId, systemId);
    if (!lock || !lock.isLocked) {
        throw new CredentialNotLockedError(userId, systemId);
    }

    const updated = await repo.updateLockRecord(userId, systemId, {
        isLocked: false,
        unlockedBy: performedBy,
        unlockedAt: new Date()
    });

    await createAuditLog({
        action: 'credential.unlock',
        actorUserId: performedBy,
        entityType: 'credential',
        entityId: `${userId}:${systemId}`, // We might not have credential ID easily here without lookup
        metadata: {
            userId,
            systemId,
            wasLockedBy: lock.lockedBy,
            wasLockedAt: lock.lockedAt
        }
    });

    return updated;
};

export const isCredentialLocked = async (userId, systemId) => {
    const lock = await repo.getLockRecord(userId, systemId);
    return lock ? lock.isLocked : false;
};

export const getLockedCredentials = async (filters = {}) => {
    const result = await repo.getLockedCredentials(filters);
    const lockedByMap = await getLockedByMap(result.data);

    const data = result.data.map(lock => ({
        id: lock.id,
        userId: lock.userId,
        userName: lock.user?.username || null,
        userEmail: lock.user?.ldapAttributes?.mail || null,
        systemId: lock.systemId,
        systemName: lock.system?.description || lock.systemId,
        lockedBy: lock.lockedBy,
        lockedByName: lockedByMap.get(lock.lockedBy)?.username || null,
        lockedAt: toIsoString(lock.lockedAt),
        lockReason: lock.lockReason || null
    }));

    return {
        data,
        meta: result.meta
    };
};

export const getLockStatus = async (userId, systemId) => {
    const lock = await repo.getLockRecord(userId, systemId);
    if (!lock || !lock.isLocked) {
        return { isLocked: false, lockDetails: null };
    }

    const lockedByMap = await getLockedByMap([lock]);
    const lockedByName = lockedByMap.get(lock.lockedBy)?.username || null;

    return {
        isLocked: true,
        lockDetails: {
            lockedBy: lock.lockedBy,
            lockedByName,
            lockedAt: toIsoString(lock.lockedAt),
            lockReason: lock.lockReason || null,
            daysLocked: calculateDaysLocked(lock.lockedAt)
        }
    };
};
