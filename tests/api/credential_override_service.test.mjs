import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/it_hub_test";

const {
    confirmCredentialOverride,
    previewCredentialOverride
} = await import("../../apps/api/src/features/credentials/service.js");

const activeUserRepo = { isUserDisabled: () => false };

test("previewCredentialOverride keeps unchanged values for partial override", async () => {
    const stored = { token: null, session: null };
    const repoMock = {
        getUserById: async () => ({ id: "user-1", username: "target", status: "active" }),
        getUserCredentialBySystem: async () => ({
            id: "cred-1",
            userId: "user-1",
            systemId: "email",
            username: "old.username",
            password: "old-password",
            templateVersion: 3
        }),
        storePreviewSession: async (token, sessionData) => {
            stored.token = token;
            stored.session = sessionData;
            return token;
        }
    };

    const result = await previewCredentialOverride(
        "user-1",
        "email",
        {
            username: "new.username",
            reason: "Requested naming standard update for mailbox provisioning"
        },
        {
            repo: repoMock,
            userRepo: activeUserRepo,
            tokenFactory: () => "override_test_token"
        }
    );

    assert.equal(result.previewToken, "override_test_token");
    assert.equal(result.proposedCredential.username, "new.username");
    assert.equal(result.changes.usernameChanged, true);
    assert.equal(result.changes.passwordChanged, false);
    assert.equal(stored.token, "override_test_token");
    assert.equal(stored.session.type, "override");
    assert.equal(stored.session.proposedCredential.password, "old-password");
});

test("previewCredentialOverride accepts manual IMAP password from provider", async () => {
    const stored = { token: null, session: null };
    const repoMock = {
        getUserById: async () => ({
            id: "user-1",
            username: "target",
            status: "active",
            ldapAttributes: {
                mail: "john.doe@company.com"
            }
        }),
        getUserCredentialBySystem: async () => ({
            id: "cred-imap-1",
            userId: "user-1",
            systemId: "imap",
            username: "john.doe@company.com",
            password: "old-password",
            templateVersion: 3
        }),
        storePreviewSession: async (token, sessionData) => {
            stored.token = token;
            stored.session = sessionData;
            return token;
        }
    };

    const result = await previewCredentialOverride(
        "user-1",
        "imap",
        {
            password: "NewAppPasswordFromHost",
            reason: "User received new app password from Yahoo; recording for mailbox access"
        },
        {
            repo: repoMock,
            userRepo: activeUserRepo,
            tokenFactory: () => "imap_preview_token"
        }
    );

    assert.equal(result.previewToken, "imap_preview_token");
    assert.equal(result.currentCredential.username, "john.doe@company.com");
    assert.equal(result.changes.passwordChanged, true);
    assert.equal(stored.session.proposedCredential.password, "NewAppPasswordFromHost");
    assert.equal(stored.session.mode, null);
});

test("confirmCredentialOverride stores IMAP metadata on version history", async () => {
    const calls = {
        versions: [],
        createdCredential: null,
        deletedToken: null,
        auditMetadata: null
    };

    const repoMock = {
        getUserById: async () => ({ id: "user-1", username: "target", status: "active" }),
        getUserCredentialBySystem: async () => ({
            id: "cred-old",
            userId: "user-1",
            systemId: "imap",
            username: "john.doe@company.com",
            password: "old-password",
            templateVersion: 3
        }),
        createCredentialVersion: async (data) => {
            calls.versions.push(data);
            return { id: `version-${calls.versions.length}` };
        },
        deactivateUserCredential: async () => true,
        createUserCredential: async (data) => {
            calls.createdCredential = data;
            return { id: "cred-new", ...data };
        },
        deletePreviewSession: async (token) => {
            calls.deletedToken = token;
            return true;
        }
    };

    const prismaMock = {
        $transaction: async (fn) =>
            fn({
                auditLog: {
                    create: async ({ data }) => {
                        calls.auditMetadata = data.metadata;
                        return { id: "audit-1" };
                    }
                }
            })
    };

    const previewSession = {
        token: "imap_preview_token",
        userId: "user-1",
        system: "imap",
        proposedCredential: {
            username: "john.doe@company.com",
            password: "new-password"
        },
        currentCredentialId: "cred-old",
        reason: "User received new app password from Yahoo; recording for mailbox access",
        changes: {
            usernameChanged: false,
            passwordChanged: true
        },
        metadata: {
            mode: "provider_recorded",
            saveMode: "active"
        }
    };

    const result = await confirmCredentialOverride("actor-1", previewSession, {
        repo: repoMock,
        prisma: prismaMock
    });

    assert.equal(result.credentialId, "cred-new");
    assert.equal(calls.versions.length, 2);
    assert.deepEqual(calls.versions[1].metadata, previewSession.metadata);
    assert.deepEqual(calls.auditMetadata.metadata, previewSession.metadata);
    assert.deepEqual(calls.auditMetadata.changedFields, []);
    assert.equal(calls.deletedToken, "imap_preview_token");
});
