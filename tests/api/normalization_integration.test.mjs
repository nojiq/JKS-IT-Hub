import test, { describe, it, after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";
import * as credentialService from "../../apps/api/src/features/credentials/service.js";
import * as normalizationRuleService from "../../apps/api/src/features/normalization-rules/service.js";

describe('Credential Generation Normalization Integration', () => {
    let testUser;
    let systemConfig;
    const createdUserIds = [];
    const createdSystemIds = [];

    before(async () => {
        try {
            // Clean up previous templates to ensure clean state
            await prisma.credentialTemplate.updateMany({ data: { isActive: false } });

            // Create a test user with LDAP attributes
            testUser = await prisma.user.create({
                data: {
                    username: `testuser-${randomUUID()}`,
                    role: 'requester',
                    status: 'active',
                    ldapAttributes: {
                        mail: 'John.DOE@Example.com',
                        sAMAccountName: 'jdoe'
                    }
                }
            });
            createdUserIds.push(testUser.id);

            // Create a system config
            const systemId = 'test-sys-' + randomUUID().substring(0, 8);
            systemConfig = await prisma.systemConfig.create({
                data: {
                    systemId,
                    usernameLdapField: 'mail'
                }
            });
            createdSystemIds.push(systemId);

            // Create active template
            await prisma.credentialTemplate.create({
                data: {
                    name: 'Test Template',
                    isActive: true,
                    version: 1,
                    createdBy: testUser.id,
                    structure: {
                        systems: [systemId],
                        fields: [
                            { name: 'username', ldapSource: 'mail', required: true },
                            { name: 'password', pattern: '{fixed:pass123}', required: false }
                        ]
                    }
                }
            });
        } catch (err) {
            console.error('BEFORE HOOK FAILED:', err);
            throw err;
        }
    });

    after(async () => {
        await prisma.normalizationRule.deleteMany({});
        if (createdUserIds.length > 0) {
            await prisma.user.deleteMany({
                where: { id: { in: createdUserIds } }
            });
        }
        if (createdSystemIds.length > 0) {
            await prisma.systemConfig.deleteMany({
                where: { systemId: { in: createdSystemIds } }
            });
        }
        await prisma.$disconnect();
    });

    it('should apply normalization rules during credential preview', async () => {
        try {
            // Create a lowercase rule for the system
            await normalizationRuleService.createNormalizationRule({
                ruleType: 'lowercase',
                systemId: systemConfig.systemId,
                priority: 0
            }, testUser.id);

            const preview = await credentialService.previewUserCredentials(testUser.id, systemConfig.systemId);

            if (!preview.success) {
                console.error('TEST 1 PREVIEW FAILED:', JSON.stringify(preview.error, null, 2));
                assert.fail('Preview failed');
            }

            assert.ok(preview.success);
            const cred = preview.credentials.find(c => c.system === systemConfig.systemId);
            assert.equal(cred.username, 'john.doe@example.com');
        } catch (err) {
            console.error('TEST 1 CAUGHT ERROR:', err);
            throw err;
        }
    });

    it('should apply global rules during credential preview', async () => {
        try {
            await prisma.normalizationRule.deleteMany({});

            await normalizationRuleService.createNormalizationRule({
                ruleType: 'remove_special',
                priority: 0
            }, testUser.id);

            const preview = await credentialService.previewUserCredentials(testUser.id, systemConfig.systemId);

            if (!preview.success) {
                console.error('TEST 2 PREVIEW FAILED:', JSON.stringify(preview.error, null, 2));
                assert.fail('Preview failed');
            }

            assert.ok(preview.success);
            const cred = preview.credentials.find(c => c.system === systemConfig.systemId);
            assert.equal(cred.username, 'JohnDOEExamplecom');
        } catch (err) {
            console.error('TEST 2 CAUGHT ERROR:', err);
            throw err;
        }
    });
});
