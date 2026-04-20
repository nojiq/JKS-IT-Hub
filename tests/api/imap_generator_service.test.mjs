import test from "node:test";
import assert from "node:assert/strict";

import {
    upsertUserImapProfile,
    createImapCredentialRecord,
    listImapCredentialRecords
} from "../../apps/api/src/features/credentials/repo.js";

test("upsertUserImapProfile persists deterministic subject key and system fields", async () => {
    let upsertArgs = null;
    const tx = {
        userImapProfile: {
            upsert: async (args) => {
                upsertArgs = args;
                return {
                    id: "profile-1",
                    ...args.create
                };
            }
        }
    };

    const result = await upsertUserImapProfile(
        {
            userId: "user-1",
            deterministicSubjectKey: "user-1",
            email: "abu@example.com",
            firstName: "Abu",
            lastName: "Bakar",
            fullName: "Abu Bakar",
            dob: "2021-01-21",
            phone: "123",
            resolvedLdapFingerprints: {
                fullName: "abc123"
            },
            updatedBy: "actor-1"
        },
        tx
    );

    assert.equal(upsertArgs.where.userId, "user-1");
    assert.equal(upsertArgs.create.deterministicSubjectKey, "user-1");
    assert.equal(upsertArgs.update.fullName, "Abu Bakar");
    assert.equal(result.id, "profile-1");
    assert.equal(result.userId, "user-1");
});

test("createImapCredentialRecord keeps history-only records inactive", async () => {
    let createArgs = null;
    const tx = {
        userCredential: {
            create: async (args) => {
                createArgs = args;
                return {
                    id: "cred-1",
                    ...args.data
                };
            }
        }
    };

    const result = await createImapCredentialRecord(
        {
            userId: "user-1",
            systemId: "imap",
            username: "abu@example.com",
            password: "Secret123",
            templateVersion: 3,
            metadata: {
                saveMode: "history_only",
                subjectKey: "manual:abu|abu@example.com",
                selectedFields: ["dob", "phone"],
                sources: {
                    dob: "system",
                    phone: "system"
                }
            },
            isActive: false,
            generatedBy: "actor-1"
        },
        tx
    );

    assert.equal(createArgs.data.systemId, "imap");
    assert.equal(createArgs.data.isActive, false);
    assert.equal(createArgs.data.metadata.saveMode, "history_only");
    assert.equal(result.id, "cred-1");
    assert.equal(result.isActive, false);
});

test("listImapCredentialRecords loads active and archived IMAP rows without filtering out inactive records", async () => {
    let findManyArgs = null;
    const tx = {
        userCredential: {
            findMany: async (args) => {
                findManyArgs = args;
                return [
                    {
                        id: "cred-active",
                        userId: "user-1",
                        systemId: "imap",
                        username: "abu@example.com",
                        password: "active-password",
                        isActive: true,
                        metadata: { saveMode: "active" },
                        generatedAt: new Date("2026-04-20T10:00:00.000Z")
                    },
                    {
                        id: "cred-archive",
                        userId: "user-1",
                        systemId: "imap",
                        username: "abu@example.com",
                        password: "old-password",
                        isActive: false,
                        metadata: { saveMode: "history_only" },
                        generatedAt: new Date("2026-04-19T10:00:00.000Z")
                    }
                ];
            }
        }
    };

    const result = await listImapCredentialRecords("user-1", tx);

    assert.equal(findManyArgs.where.userId, "user-1");
    assert.equal(findManyArgs.where.systemId, "imap");
    assert.equal("isActive" in findManyArgs.where, false);
    assert.equal(result.length, 2);
    assert.equal(result[0].id, "cred-active");
    assert.equal(result[1].id, "cred-archive");
});
