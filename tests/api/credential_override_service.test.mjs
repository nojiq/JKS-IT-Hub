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
