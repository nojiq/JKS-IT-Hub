import test, { describe, it, after, afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import * as normalizationRuleService from '../../apps/api/src/features/normalization-rules/service.js';
import { prisma } from '../../apps/api/src/shared/db/prisma.js';
import { randomUUID } from 'node:crypto';

describe('NormalizationRuleService', () => {
    let testUser;
    const createdSystemIds = [];

    before(async () => {
        // Find or create an IT user for audit logging
        testUser = await prisma.user.findFirst({ where: { role: 'it' } });
        if (!testUser) {
            testUser = await prisma.user.create({
                data: {
                    username: `test-it-${randomUUID()}`,
                    role: 'it',
                    status: 'active'
                }
            });
        }
    });

    afterEach(async () => {
        // Clean up rules after each test
        await prisma.normalizationRule.deleteMany({});
    });

    after(async () => {
        // Clean up systems
        if (createdSystemIds.length > 0) {
            await prisma.systemConfig.deleteMany({
                where: { systemId: { in: createdSystemIds } }
            });
        }
        await prisma.$disconnect();
    });

    describe('applyNormalizationRules', () => {
        it('should apply lowercase rule', async () => {
            await normalizationRuleService.createNormalizationRule({
                ruleType: 'lowercase',
                priority: 0
            }, testUser.id);

            const result = await normalizationRuleService.applyNormalizationRules('John.Doe@Example.com');
            assert.equal(result.normalized, 'john.doe@example.com');
        });

        it('should apply remove_spaces rule', async () => {
            await normalizationRuleService.createNormalizationRule({
                ruleType: 'remove_spaces',
                priority: 0
            }, testUser.id);

            const result = await normalizationRuleService.applyNormalizationRules('John Doe');
            assert.equal(result.normalized, 'JohnDoe');
        });

        it('should apply truncate rule', async () => {
            await normalizationRuleService.createNormalizationRule({
                ruleType: 'truncate',
                ruleConfig: { maxLength: 5 },
                priority: 0
            }, testUser.id);

            const result = await normalizationRuleService.applyNormalizationRules('JohnDoe');
            assert.equal(result.normalized, 'JohnD');
        });

        it('should apply multiple rules in priority order', async () => {
            // Rule 1: Lowercase (priority 1)
            await normalizationRuleService.createNormalizationRule({
                ruleType: 'lowercase',
                priority: 1
            }, testUser.id);

            // Rule 2: Remove dots (regex) (priority 0)
            await normalizationRuleService.createNormalizationRule({
                ruleType: 'regex',
                ruleConfig: { pattern: '\\.', replacement: '' },
                priority: 0
            }, testUser.id);

            const result = await normalizationRuleService.applyNormalizationRules('John.Doe');
            // Priority 0: John.Doe -> JohnDoe
            // Priority 1: JohnDoe -> johndoe
            assert.equal(result.normalized, 'johndoe');
        });

        it('should apply per-system rules over global rules', async () => {
            // Create a system for testing
            const systemId = 'test-sys-' + randomUUID().substring(0, 8);
            await prisma.systemConfig.create({
                data: {
                    systemId,
                    usernameLdapField: 'mail'
                }
            });
            createdSystemIds.push(systemId);

            // Global rule: Lowercase
            await normalizationRuleService.createNormalizationRule({
                ruleType: 'lowercase',
                priority: 0
            }, testUser.id);

            // Per-system rule: Truncate to 3
            await normalizationRuleService.createNormalizationRule({
                ruleType: 'truncate',
                ruleConfig: { maxLength: 3 },
                systemId,
                priority: 1
            }, testUser.id);

            const result = await normalizationRuleService.applyNormalizationRules('JohnDoe', systemId);
            // Global: JohnDoe -> johndoe
            // System: johndoe -> joh
            assert.equal(result.normalized, 'joh');
        });

        it('should throw error if output becomes empty', async () => {
            await normalizationRuleService.createNormalizationRule({
                ruleType: 'regex',
                ruleConfig: { pattern: '.*', replacement: '' },
                priority: 0
            }, testUser.id);

            await assert.rejects(
                async () => await normalizationRuleService.applyNormalizationRules('something'),
                { name: 'NormalizationEmptyError' }
            );
        });
    });
});
