import test from "node:test";
import assert from "node:assert/strict";
import {
    confirmCredentialOverride,
    previewCredentialOverride
} from "../../apps/api/src/features/credentials/service.js";

const activeUserRepo = { isUserDisabled: () => false };

test("previewCredentialOverride blocks locked credentials", async () => {
    const repoMock = {
        getUserById: async () => ({ id: "user-1", username: "target", status: "active" }),
        getLockRecord: async () => ({
            isLocked: true,
            lockedAt: new Date("2026-02-09T12:00:00.000Z"),
            lockReason: "Incident freeze"
        })
    };

    await assert.rejects(
        () =>
            previewCredentialOverride(
                "user-1",
                "email",
                { username: "new.user", reason: "Need manual override for migration" },
                { repo: repoMock, userRepo: activeUserRepo }
            ),
        (error) => {
            assert.equal(error.code, "CREDENTIAL_LOCKED");
            assert.equal(error.userId, "user-1");
            assert.equal(error.systemId, "email");
            return true;
        }
    );
});

test("previewCredentialOverride keeps unchanged values for partial override", async () => {
    const stored = { token: null, session: null };
    const repoMock = {
        getUserById: async () => ({ id: "user-1", username: "target", status: "active" }),
        getLockRecord: async () => null,
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

test("confirmCredentialOverride blocks when credential is locked at confirm time", async () => {
    const repoMock = {
        getUserById: async () => ({ id: "user-1", username: "target", status: "active" }),
        getUserCredentialBySystem: async () => ({
            id: "cred-old",
            userId: "user-1",
            systemId: "email",
            username: "old.username",
            password: "old-password",
            templateVersion: 3
        }),
        getLockRecord: async () => ({
            isLocked: true,
            lockedAt: new Date("2026-02-09T12:00:00.000Z"),
            lockReason: "Security freeze"
        })
    };

    const prismaMock = {
        $transaction: async (fn) =>
            fn({
                auditLog: {
                    create: async () => ({ id: "audit-1" })
                }
            })
    };

    await assert.rejects(
        () =>
            confirmCredentialOverride(
                "actor-1",
                {
                    token: "override_test_token",
                    userId: "user-1",
                    system: "email",
                    proposedCredential: { username: "new.username", password: "new-password" },
                    currentCredentialId: "cred-old",
                    reason: "Security rotation",
                    changes: { usernameChanged: true, passwordChanged: true }
                },
                { repo: repoMock, prisma: prismaMock }
            ),
        (error) => {
            assert.equal(error.code, "CREDENTIAL_LOCKED");
            assert.equal(error.systemId, "email");
            return true;
        }
    );
});

test("previewCredentialOverride builds deterministic IMAP preview metadata", async () => {
    const stored = { token: null, session: null };
    const repoMock = {
        getUserById: async () => ({
            id: "user-1",
            username: "target",
            status: "active",
            ldapAttributes: {
                mail: "john.doe@company.com",
                givenName: "John",
                sn: "Doe",
                birthDate: "1990-01-01",
                telephoneNumber: "0123456789"
            }
        }),
        getLockRecord: async () => null,
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
            mode: "imap_deterministic",
            reason: "Update IMAP deterministic password after data cleanup",
            inputs: {
                email: " John.Doe@Company.com ",
                firstName: "John",
                lastName: "Doe",
                fullName: "John Doe",
                dob: "1990-01-01",
                phone: "0123456789"
            },
            selectedFields: {
                email: true,
                firstName: false,
                lastName: true,
                fullName: false,
                dob: true,
                phone: true
            },
            origins: {
                email: "ldap",
                lastName: "ldap",
                dob: "manual",
                phone: "manual"
            }
        },
        {
            repo: repoMock,
            userRepo: activeUserRepo,
            tokenFactory: () => "imap_preview_token"
        }
    );

    assert.equal(result.previewToken, "imap_preview_token");
    assert.equal(result.currentCredential.username, "john.doe@company.com");
    assert.equal(result.proposedCredential.username, "john.doe@company.com");
    assert.match(result.proposedCredential.password.masked, /•+/);
    assert.equal(result.metadata.subjectKey, "user-1");
    assert.deepEqual(result.metadata.selectedFields, ["dob", "email", "lastName", "phone"]);
    assert.deepEqual(result.metadata.changedFields, ["email", "lastName", "dob", "phone"]);
    assert.equal(stored.session.mode, "imap_deterministic");
    assert.equal(stored.session.subjectKey, "user-1");
    assert.deepEqual(stored.session.metadata.selectedFields, ["dob", "email", "lastName", "phone"]);
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
        getLockRecord: async () => null,
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
        mode: "imap_deterministic",
        proposedCredential: {
            username: "john.doe@company.com",
            password: "new-password"
        },
        currentCredentialId: "cred-old",
        reason: "Update IMAP deterministic password after data cleanup",
        changes: {
            usernameChanged: false,
            passwordChanged: true,
            changedFields: ["phone"]
        },
        metadata: {
            mode: "imap_deterministic",
            algorithmVersion: 1,
            selectedFields: ["email", "phone"],
            changedFields: ["phone"],
            origins: {
                email: "ldap",
                phone: "manual"
            }
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
    assert.deepEqual(calls.auditMetadata.changedFields, ["phone"]);
    assert.equal(calls.deletedToken, "imap_preview_token");
});
