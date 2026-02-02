import * as repo from "./repo.js";
import { prisma } from "../../shared/db/prisma.js";
import { generateCredentials, previewCredentials, MissingLdapFieldsError, NoActiveTemplateError } from "./generator.js";

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
