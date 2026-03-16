import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/it_hub_test";

const {
    detectChanges,
    NoChangesDetectedError,
    DisabledUserError,
    previewUserCredentials,
    savePreviewedCredentials,
    getVersionContext,
    formatHistoryEntry,
    compareCredentialVersions,
    confirmCredentialOverride
} = await import(
    "../../apps/api/src/features/credentials/service.js"
);

test("detectChanges reports template version change", () => {
    const user = { id: "u1", ldapAttributes: { mail: "user@example.com" } };
    const existingCredentials = [
        { templateVersion: 1 }
    ];
    const template = { version: 2 };

    const result = detectChanges(user, existingCredentials, template);
    assert.equal(result.templateChanged, true);
    assert.equal(result.oldTemplateVersion, 1);
    assert.equal(result.newTemplateVersion, 2);
});

test("detectChanges treats no existing credentials as changed", () => {
    const user = { id: "u1", ldapAttributes: {} };
    const template = { version: 1 };

    const result = detectChanges(user, [], template);
    assert.equal(result.ldapChanged, true);
    assert.equal(result.templateChanged, false);
});

test("error classes carry expected metadata", () => {
    const disabled = new DisabledUserError("user-123");
    assert.equal(disabled.code, "DISABLED_USER");
    assert.equal(disabled.userId, "user-123");

    const unchanged = new NoChangesDetectedError("user-456", "2026-02-09T00:00:00.000Z");
    assert.equal(unchanged.code, "NO_CHANGES_DETECTED");
    assert.equal(unchanged.userId, "user-456");
});

test("previewUserCredentials blocks disabled users before generation when user is disabled", async () => {
    const repoMock = {
        getActiveCredentialTemplate: async () => ({
            id: "template-1",
            version: 1,
            structure: { systems: ["email"], fields: [] }
        }),
        getUserById: async () => ({
            id: "user-1",
            status: "disabled",
            ldapAttributes: { mail: "disabled@example.com" }
        })
    };
    const userRepoMock = {
        isUserDisabled: () => true
    };

    await assert.rejects(
        () => previewUserCredentials("user-1", null, { repo: repoMock, userRepo: userRepoMock }),
        (error) => error instanceof DisabledUserError && error.userId === "user-1"
    );
});

test("savePreviewedCredentials blocks disabled users before persisting credentials", async () => {
    const calls = { deactivated: 0, created: 0 };
    const repoMock = {
        getUserById: async () => ({ id: "user-1", status: "disabled" }),
        deactivateUserCredentials: async () => {
            calls.deactivated += 1;
        },
        createUserCredential: async () => {
            calls.created += 1;
        },
        createCredentialVersion: async () => {
            calls.created += 1;
        }
    };
    const userRepoMock = {
        isUserDisabled: () => true
    };
    const prismaMock = {
        $transaction: async (fn) => fn({})
    };

    await assert.rejects(
        () =>
            savePreviewedCredentials(
                "actor-1",
                {
                    userId: "user-1",
                    credentials: [{ system: "email", username: "u", password: "p" }],
                    templateVersion: 1
                },
                { repo: repoMock, userRepo: userRepoMock, prisma: prismaMock }
            ),
        (error) => error instanceof DisabledUserError && error.userId === "user-1"
    );

    assert.equal(calls.deactivated, 0);
    assert.equal(calls.created, 0);
});

test("getVersionContext maps data from credential relation when flat fields are absent", () => {
    const version = {
        id: "v1",
        credential: {
            userId: "user-1",
            systemId: "email",
            templateVersion: 3,
            isActive: false
        }
    };

    const context = getVersionContext(version);
    assert.equal(context.userId, "user-1");
    assert.equal(context.system, "email");
    assert.equal(context.templateVersion, 3);
    assert.equal(context.isCurrent, false);
});

test("formatHistoryEntry outputs stable API shape from relation-backed version", () => {
    const version = {
        id: "v2",
        username: "john.doe",
        password: "secret",
        reason: "override",
        createdAt: new Date("2026-02-09T00:00:00.000Z"),
        createdByUser: { id: "actor-1", username: "it-user" },
        credential: {
            userId: "user-2",
            systemId: "vpn",
            templateVersion: 4,
            isActive: true
        }
    };

    const entry = formatHistoryEntry(version);
    assert.equal(entry.userId, "user-2");
    assert.equal(entry.system, "vpn");
    assert.equal(entry.templateVersion, 4);
    assert.equal(entry.isCurrent, true);
    assert.equal(entry.password.revealed, null);
});

test("compareCredentialVersions works with relation-backed version context", async () => {
    const createdAt1 = new Date("2026-02-09T00:00:00.000Z");
    const createdAt2 = new Date("2026-02-09T00:01:00.000Z");
    const loadVersions = async () => ([
        {
            id: "version-1",
            username: "john.old",
            password: "old-pass",
            reason: "initial",
            createdAt: createdAt1,
            credential: { userId: "u1", systemId: "email", templateVersion: 2, isActive: false },
            createdByUser: { id: "a1", username: "actor-1" }
        },
        {
            id: "version-2",
            username: "john.new",
            password: "new-pass",
            reason: "override",
            createdAt: createdAt2,
            credential: { userId: "u1", systemId: "email", templateVersion: 2, isActive: true },
            createdByUser: { id: "a2", username: "actor-2" }
        }
    ]);

    const result = await compareCredentialVersions("version-1", "version-2", loadVersions);
    assert.equal(result.system, "email");
    assert.ok(result.differences.some((d) => d.field === "username"));
    assert.ok(result.differences.some((d) => d.field === "password"));
});

test("compareCredentialVersions rejects versions from different systems", async () => {
    const loadVersions = async () => ([
        {
            id: "version-1",
            username: "john",
            password: "old-pass",
            reason: "initial",
            createdAt: new Date("2026-02-09T00:00:00.000Z"),
            credential: { userId: "u1", systemId: "email", templateVersion: 1, isActive: false },
            createdByUser: { id: "a1", username: "actor-1" }
        },
        {
            id: "version-2",
            username: "john",
            password: "new-pass",
            reason: "override",
            createdAt: new Date("2026-02-09T00:01:00.000Z"),
            credential: { userId: "u1", systemId: "vpn", templateVersion: 1, isActive: true },
            createdByUser: { id: "a2", username: "actor-2" }
        }
    ]);

    await assert.rejects(
        () => compareCredentialVersions("version-1", "version-2", loadVersions),
        (error) => error.code === "DIFFERENT_SYSTEMS"
    );
});

test("compareCredentialVersions orders entries by time and keeps positive timeGap", async () => {
    const loadVersions = async () => ([
        {
            id: "newer-version",
            username: "john.new",
            password: "new-pass",
            reason: "override",
            createdAt: new Date("2026-02-09T00:10:00.000Z"),
            credential: { userId: "u1", systemId: "email", templateVersion: 3, isActive: true },
            createdByUser: { id: "a2", username: "actor-2" }
        },
        {
            id: "older-version",
            username: "john.old",
            password: "old-pass",
            reason: "initial",
            createdAt: new Date("2026-02-09T00:01:00.000Z"),
            credential: { userId: "u1", systemId: "email", templateVersion: 2, isActive: false },
            createdByUser: { id: "a1", username: "actor-1" }
        }
    ]);

    const result = await compareCredentialVersions("newer-version", "older-version", loadVersions);
    assert.equal(result.version1.id, "older-version");
    assert.equal(result.version2.id, "newer-version");
    assert.match(result.timeGap, /minute/);
    assert.ok(!result.timeGap.startsWith("-"));

    const usernameDiff = result.differences.find((d) => d.field === "username");
    assert.equal(usernameDiff.oldValue, "john.old");
    assert.equal(usernameDiff.newValue, "john.new");
});

test("confirmCredentialOverride persists override using current DB snapshot fields", async () => {
    const calls = {
        versionCreates: [],
        userCredentialCreates: [],
        deactivations: [],
        previewDeletes: []
    };

    const repoMock = {
        getUserById: async () => ({ id: "user-1", username: "target-user", status: "active" }),
        getUserCredentialBySystem: async () => ({
            id: "cred-old",
            userId: "user-1",
            systemId: "email",
            username: "old.username",
            password: "old-password",
            templateVersion: 7
        }),
        createCredentialVersion: async (data) => {
            calls.versionCreates.push(data);
            return { id: `version-${calls.versionCreates.length}` };
        },
        deactivateUserCredential: async (id) => {
            calls.deactivations.push(id);
            return { id, isActive: false };
        },
        createUserCredential: async (data) => {
            calls.userCredentialCreates.push(data);
            return { id: "cred-new" };
        },
        deletePreviewSession: async (token) => {
            calls.previewDeletes.push(token);
            return true;
        }
    };

    const prismaMock = {
        $transaction: async (fn) => fn({
            auditLog: {
                create: async () => ({ id: "audit-1" })
            }
        })
    };

    const result = await confirmCredentialOverride(
        "actor-1",
        {
            token: "override-token",
            userId: "user-1",
            system: "email",
            proposedCredential: { username: "new.username", password: "new-password" },
            currentCredentialId: "cred-old",
            reason: "Rotating access due policy update",
            changes: { usernameChanged: true, passwordChanged: true }
        },
        { repo: repoMock, prisma: prismaMock }
    );

    assert.equal(result.credentialId, "cred-new");
    assert.equal(calls.deactivations[0], "cred-old");
    assert.equal(calls.previewDeletes[0], "override-token");
    assert.equal(calls.userCredentialCreates[0].systemId, "email");
    assert.equal(calls.userCredentialCreates[0].templateVersion, 7);
    assert.equal(calls.versionCreates[0].password, "old-password");
    assert.equal(calls.versionCreates[1].reason, "override");
});
