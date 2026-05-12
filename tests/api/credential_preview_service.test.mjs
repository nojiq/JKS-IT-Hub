import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/it_hub_test";

const {
    previewUserCredentials,
    savePreviewedCredentials
} = await import("../../apps/api/src/features/credentials/service.js");

const activeUserRepo = {
    isUserDisabled: () => false
};

const passthroughNormalization = {
    applyNormalizationRules: async (value) => ({ normalized: value, rulesApplied: [] })
};

test("previewUserCredentials generates preview without persisting credentials", async () => {
    const calls = { created: 0, versions: 0 };
    const repo = {
        getActiveCredentialTemplate: async () => ({
            id: "template-1",
            version: 3,
            structure: {
                systems: ["email", "vpn"],
                fields: [
                    { name: "username", ldapSource: "mail" },
                    { name: "password", pattern: "{random:8}" }
                ]
            }
        }),
        getUserById: async () => ({
            id: "user-123",
            status: "active",
            ldapAttributes: {
                mail: "john.doe@example.com",
                cn: "John Doe"
            }
        }),
        createUserCredential: async () => {
            calls.created += 1;
        },
        createCredentialVersion: async () => {
            calls.versions += 1;
        }
    };
    const systemConfigRepo = {
        getSystemConfigById: async () => ({
            systemId: "email",
            usernameLdapField: "mail",
            normalizationRules: []
        })
    };

    const result = await previewUserCredentials("user-123", "email", {
        repo,
        userRepo: activeUserRepo,
        systemConfigRepo,
        normalizationRuleService: passthroughNormalization
    });

    assert.equal(result.success, true);
    assert.equal(result.userId, "user-123");
    assert.equal(result.templateVersion, 3);
    assert.equal(result.credentials.length, 1);
    assert.equal(result.credentials[0].system, "email");
    assert.equal(result.credentials[0].ldapSources.username, "mail");
    assert.equal(calls.created, 0);
    assert.equal(calls.versions, 0);
});

test("previewUserCredentials returns structured error for missing LDAP fields", async () => {
    const repo = {
        getActiveCredentialTemplate: async () => ({
            id: "template-1",
            version: 1,
            structure: {
                systems: ["email"],
                fields: [
                    { name: "username", ldapSource: "mail", required: true },
                    { name: "password", pattern: "{random:8}" }
                ]
            }
        }),
        getUserById: async () => ({
            id: "user-123",
            status: "active",
            ldapAttributes: { cn: "John Doe" }
        })
    };
    const systemConfigRepo = {
        getSystemConfigById: async () => ({
            systemId: "email",
            usernameLdapField: "mail",
            normalizationRules: []
        })
    };

    const result = await previewUserCredentials("user-123", "email", {
        repo,
        userRepo: activeUserRepo,
        systemConfigRepo,
        normalizationRuleService: passthroughNormalization
    });

    assert.equal(result.success, false);
    assert.equal(result.error.code, "MISSING_LDAP_FIELDS");
    assert.ok(result.error.missingFields.includes("mail"));
});

test("savePreviewedCredentials persists credentials only during confirmation", async () => {
    const calls = { deactivated: 0, credentials: 0, versions: 0 };
    const repo = {
        getUserById: async () => ({ id: "user-123", status: "active" }),
        deactivateUserCredentials: async () => {
            calls.deactivated += 1;
        },
        createUserCredential: async (data) => {
            calls.credentials += 1;
            return { id: `cred-${calls.credentials}`, ...data };
        },
        createCredentialVersion: async () => {
            calls.versions += 1;
            return { id: `version-${calls.versions}` };
        }
    };
    const prisma = {
        $transaction: async (fn) => fn({})
    };

    const result = await savePreviewedCredentials(
        "actor-456",
        {
            userId: "user-123",
            templateVersion: 3,
            credentials: [
                { system: "email", username: "john@example.com", password: "pass123" },
                { system: "vpn", username: "john", password: "vpn456" }
            ]
        },
        { repo, userRepo: activeUserRepo, prisma }
    );

    assert.equal(result.userId, "user-123");
    assert.equal(result.credentials.length, 2);
    assert.equal(calls.deactivated, 1);
    assert.equal(calls.credentials, 2);
    assert.equal(calls.versions, 2);
});
