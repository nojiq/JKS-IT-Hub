import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";
import * as service from "../../apps/api/src/features/system-configs/service.js";
import * as repo from "../../apps/api/src/features/system-configs/repo.js";
import { createUser } from "../../apps/api/src/features/users/repo.js";

const uniqueSystemId = (prefix) => `${prefix}-${randomUUID().slice(0, 8)}`;

after(async () => {
    await prisma.$disconnect();
});

test("System Config Service - Create", async (t) => {
    const actor = await createUser({ username: `test-${randomUUID()}`, role: "it" });

    await t.test("createSystemConfig creates config with valid data", async () => {
        const systemId = uniqueSystemId("test-email");
        const config = await service.createSystemConfig({
            systemId,
            usernameLdapField: "mail",
            description: "Test email system"
        }, actor.id);

        assert.equal(config.systemId, systemId);
        assert.equal(config.usernameLdapField, "mail");
        assert.equal(config.description, "Test email system");
        assert.ok(config.id);
        assert.ok(config.createdAt);
    });

    await t.test("createSystemConfig rejects non-kebab-case systemId", async () => {
        await assert.rejects(
            service.createSystemConfig({
                systemId: "TestEmail",
                usernameLdapField: "mail"
            }, actor.id),
            { code: "INVALID_SYSTEM_ID_FORMAT" }
        );
    });

    await t.test("createSystemConfig rejects duplicate systemId", async () => {
        const systemId = uniqueSystemId("test-vpn");
        // First create should succeed
        await service.createSystemConfig({
            systemId,
            usernameLdapField: "sAMAccountName"
        }, actor.id);

        // Second create with same ID should fail
        await assert.rejects(
            service.createSystemConfig({
                systemId,
                usernameLdapField: "uid"
            }, actor.id),
            { code: "DUPLICATE_SYSTEM" }
        );
    });

    await t.test("createSystemConfig validates LDAP field exists", async () => {
        await assert.rejects(
            service.createSystemConfig({
                systemId: uniqueSystemId("test-wifi"),
                usernameLdapField: "nonExistentField123"
            }, actor.id),
            { code: "LDAP_FIELD_NOT_FOUND" }
        );
    });
});

test("System Config Service - Read", async (t) => {
    await t.test("getSystemConfigs returns all configs", async () => {
        const configs = await service.getSystemConfigs();
        assert.ok(Array.isArray(configs));
    });

    await t.test("getSystemConfig returns single config by ID", async () => {
        const actor = await createUser({ username: `test-${randomUUID()}`, role: "it" });
        const systemId = uniqueSystemId("test-get");
        
        const created = await service.createSystemConfig({
            systemId,
            usernameLdapField: "mail"
        }, actor.id);

        const retrieved = await service.getSystemConfig(systemId);
        assert.equal(retrieved.id, created.id);
        assert.equal(retrieved.systemId, systemId);
    });

    await t.test("getSystemConfig returns null for non-existent", async () => {
        const retrieved = await service.getSystemConfig("non-existent-system-12345");
        assert.equal(retrieved, null);
    });
});

test("System Config Service - Update", async (t) => {
    const actor = await createUser({ username: `test-${randomUUID()}`, role: "it" });

    await t.test("updateSystemConfig updates fields", async () => {
        const systemId = uniqueSystemId("test-update");
        const created = await service.createSystemConfig({
            systemId,
            usernameLdapField: "mail",
            description: "Original description"
        }, actor.id);

        const updated = await service.updateSystemConfig(systemId, {
            description: "Updated description"
        }, actor.id);

        assert.equal(updated.description, "Updated description");
        assert.equal(updated.usernameLdapField, "mail"); // Unchanged
    });

    await t.test("updateSystemConfig validates new LDAP field", async () => {
        const systemId = uniqueSystemId("test-update-ldap");
        await service.createSystemConfig({
            systemId,
            usernameLdapField: "mail"
        }, actor.id);

        await assert.rejects(
            service.updateSystemConfig(systemId, {
                usernameLdapField: "invalidField"
            }, actor.id),
            { code: "LDAP_FIELD_NOT_FOUND" }
        );
    });

    await t.test("updateSystemConfig throws for non-existent system", async () => {
        await assert.rejects(
            service.updateSystemConfig("non-existent", {
                description: "New description"
            }, actor.id),
            { code: "SYSTEM_NOT_FOUND" }
        );
    });
});

test("System Config Service - Delete", async (t) => {
    const actor = await createUser({ username: `test-${randomUUID()}`, role: "it" });

    await t.test("deleteSystemConfig removes unused system", async () => {
        const systemId = uniqueSystemId("test-delete");
        await service.createSystemConfig({
            systemId,
            usernameLdapField: "mail"
        }, actor.id);

        const result = await service.deleteSystemConfig(systemId, actor.id);
        assert.equal(result.success, true);

        const retrieved = await service.getSystemConfig(systemId);
        assert.equal(retrieved, null);
    });

    await t.test("deleteSystemConfig blocks when system in use", async () => {
        const systemId = uniqueSystemId("test-delete-blocked");
        await service.createSystemConfig({
            systemId,
            usernameLdapField: "mail"
        }, actor.id);

        const credentialOwner = await createUser({ username: `owner-${randomUUID()}`, role: "requester" });
        await prisma.userCredential.create({
            data: {
                userId: credentialOwner.id,
                systemId,
                username: "owner@example.test",
                password: "secret",
                templateVersion: 1,
                generatedBy: actor.id
            }
        });

        const usageCount = await repo.getCredentialCountForSystem(systemId);
        assert.equal(usageCount, 1);

        let thrownError = null;
        try {
            await service.deleteSystemConfig(systemId, actor.id);
        } catch (error) {
            thrownError = error;
        }

        assert.ok(thrownError);
        assert.equal(thrownError.code, "SYSTEM_IN_USE");
        assert.equal(thrownError.credentialCount, 1);
        assert.ok(Array.isArray(thrownError.affectedUsers));
        assert.equal(thrownError.affectedUsers[0]?.id, credentialOwner.id);
    });

    await t.test("deleteSystemConfig throws for non-existent system", async () => {
        await assert.rejects(
            service.deleteSystemConfig("non-existent-delete", actor.id),
            { code: "SYSTEM_NOT_FOUND" }
        );
    });
});

test("System Config Service - LDAP Fields", async (t) => {
    await t.test("getAvailableLdapFields returns array of field names", async () => {
        const fields = await service.getAvailableLdapFields();
        assert.ok(Array.isArray(fields));
        // Fields depend on actual user data in the database
        // Should include common LDAP fields like mail, sAMAccountName, etc.
    });
});

test("System Config Repo Functions", async (t) => {
    let repoTestSystemId = "";

    await t.test("repo.createSystemConfig creates in database", async () => {
        const systemId = uniqueSystemId("repo-test");
        const config = await repo.createSystemConfig({
            systemId,
            usernameLdapField: "mail",
            description: "Repo test"
        });
        repoTestSystemId = systemId;

        assert.ok(config.id);
        assert.equal(config.systemId, systemId);
    });

    await t.test("repo.getSystemConfigs returns ordered list", async () => {
        const configs = await repo.getSystemConfigs();
        assert.ok(Array.isArray(configs));
        // Verify ordering by createdAt
        for (let i = 1; i < configs.length; i++) {
            assert.ok(configs[i-1].createdAt <= configs[i].createdAt);
        }
    });

    await t.test("repo.getSystemConfigById finds by systemId", async () => {
        const config = await repo.getSystemConfigById(repoTestSystemId);
        assert.ok(config);
        assert.ok(config.systemId.startsWith("repo-test"));
    });

    await t.test("repo.updateSystemConfig modifies fields", async () => {
        const updated = await repo.updateSystemConfig(repoTestSystemId, {
            description: "Updated repo test"
        });

        assert.equal(updated.description, "Updated repo test");
    });

    await t.test("repo.deleteSystemConfig removes record", async () => {
        await repo.deleteSystemConfig(repoTestSystemId);
        const deleted = await repo.getSystemConfigById(repoTestSystemId);
        assert.equal(deleted, null);
    });

    await t.test("repo.getCredentialCountForSystem returns count", async () => {
        const count = await repo.getCredentialCountForSystem("non-existent");
        assert.equal(count, 0);
    });

    await t.test("repo.getAvailableLdapFields extracts from user data", async () => {
        const fields = await repo.getAvailableLdapFields();
        assert.ok(Array.isArray(fields));
        // All fields should be strings
        fields.forEach(field => assert.equal(typeof field, "string"));
    });
});
