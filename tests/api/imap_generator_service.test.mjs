import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
    upsertUserImapProfile,
    createImapCredentialRecord,
    listImapCredentialRecords
} from "../../apps/api/src/features/credentials/repo.js";
import {
    loadImapWorkbench,
    previewImapPassword,
    saveImapPassword
} from "../../apps/api/src/features/credentials/imap/service.js";

const fingerprint = (value) =>
    createHash("sha256").update(String(value)).digest("hex").slice(0, 16);

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

test("loadImapWorkbench resolves system values over LDAP and hides conflicts when LDAP fingerprints have not changed", async () => {
    const repo = {
        getUserById: async () => ({
            id: "user-1",
            username: "abdullah.fauzi",
            status: "active",
            ldapAttributes: {
                mail: "abdullah.fauzi@jkseng.com",
                givenName: "Abdullah",
                sn: "Fauzi",
                cn: "Abdullah Fauzi",
                birthDate: "2021-01-21",
                telephoneNumber: "123"
            }
        }),
        getUserImapProfile: async () => ({
            userId: "user-1",
            deterministicSubjectKey: "user-1",
            fullName: "Abu",
            phone: "123",
            resolvedLdapFingerprints: {
                fullName: fingerprint("abdullah fauzi"),
                phone: fingerprint("123")
            }
        }),
        getUserCredentialBySystem: async () => ({
            id: "cred-active",
            systemId: "imap",
            username: "abdullah.fauzi@jkseng.com",
            isActive: true
        }),
        listImapCredentialRecords: async () => ([
            { id: "cred-active", isActive: true },
            { id: "cred-archive", isActive: false }
        ])
    };

    const result = await loadImapWorkbench("user-1", { repo });

    assert.equal(result.subjectKey, "user-1");
    assert.equal(result.fields.fullName.value, "Abu");
    assert.equal(result.fields.fullName.source, "system");
    assert.equal(result.fields.fullName.ldapValue, "Abdullah Fauzi");
    assert.equal(result.fields.email.value, "abdullah.fauzi@jkseng.com");
    assert.equal(result.fields.email.source, "ldap");
    assert.equal(result.previousPasswordsCount, 2);
    assert.deepEqual(result.conflicts, []);
});

test("previewImapPassword uses a stable provisional subject key for manual mode", async () => {
    const input = {
        manualIdentity: {
            fullName: "Abu",
            email: "abu@example.com"
        },
        username: "abu@example.com",
        inputs: {
            fullName: "Abu",
            dob: "2021-01-21",
            phone: "123"
        },
        selectedFields: {
            fullName: false,
            dob: true,
            phone: true
        }
    };

    const first = await previewImapPassword(input, {});
    const second = await previewImapPassword({
        ...input,
        inputs: {
            phone: "123",
            dob: "2021-01-21",
            fullName: "Abu"
        },
        selectedFields: {
            phone: true,
            dob: true,
            fullName: false
        }
    }, {});

    assert.equal(first.subjectKey, "manual:abu|abu@example.com");
    assert.equal(first.proposedCredential.username, "abu@example.com");
    assert.equal(first.proposedCredential.password, second.proposedCredential.password);
    assert.equal(first.metadata.subjectKey, "manual:abu|abu@example.com");
    assert.equal(first.metadata.sources.dob, "manual");
});

test("saveImapPassword stores history-only IMAP records without replacing the active credential", async () => {
    const calls = {
        profile: null,
        record: null,
        deactivated: []
    };

    const repo = {
        getUserById: async () => ({
            id: "user-1",
            username: "abdullah.fauzi",
            status: "active",
            ldapAttributes: {
                mail: "abdullah.fauzi@jkseng.com",
                cn: "Abdullah Fauzi"
            }
        }),
        getUserImapProfile: async () => ({
            userId: "user-1",
            deterministicSubjectKey: "user-1"
        }),
        getUserCredentialBySystem: async () => ({
            id: "cred-active",
            systemId: "imap",
            username: "abdullah.fauzi@jkseng.com",
            password: "old-password",
            templateVersion: 4,
            isActive: true
        }),
        upsertUserImapProfile: async (data) => {
            calls.profile = data;
            return data;
        },
        createImapCredentialRecord: async (data) => {
            calls.record = data;
            return {
                id: "cred-history-only",
                ...data
            };
        },
        deactivateUserCredential: async (id) => {
            calls.deactivated.push(id);
            return true;
        }
    };

    const result = await saveImapPassword(
        {
            userId: "user-1",
            username: "abdullah.fauzi@jkseng.com",
            inputs: {
                fullName: "Abu",
                dob: "2021-01-21",
                phone: "123"
            },
            selectedFields: {
                fullName: false,
                dob: true,
                phone: true
            },
            setActive: false
        },
        "actor-1",
        { repo }
    );

    assert.equal(calls.profile.fullName, "Abu");
    assert.equal(calls.profile.updatedBy, "actor-1");
    assert.equal(calls.record.isActive, false);
    assert.equal(calls.record.metadata.saveMode, "history_only");
    assert.deepEqual(calls.deactivated, []);
    assert.equal(result.record.id, "cred-history-only");
});

test("saveImapPassword can set a newly generated IMAP password active", async () => {
    const calls = {
        record: null,
        deactivated: []
    };

    const repo = {
        getUserById: async () => ({
            id: "user-1",
            username: "abdullah.fauzi",
            status: "active",
            ldapAttributes: {
                mail: "abdullah.fauzi@jkseng.com",
                cn: "Abdullah Fauzi"
            }
        }),
        getUserImapProfile: async () => ({
            userId: "user-1",
            deterministicSubjectKey: "user-1"
        }),
        getUserCredentialBySystem: async () => ({
            id: "cred-active",
            systemId: "imap",
            username: "abdullah.fauzi@jkseng.com",
            password: "old-password",
            templateVersion: 4,
            isActive: true
        }),
        upsertUserImapProfile: async (data) => data,
        createImapCredentialRecord: async (data) => {
            calls.record = data;
            return {
                id: "cred-new-active",
                ...data
            };
        },
        deactivateUserCredential: async (id) => {
            calls.deactivated.push(id);
            return true;
        }
    };

    const result = await saveImapPassword(
        {
            userId: "user-1",
            username: "abdullah.fauzi@jkseng.com",
            inputs: {
                fullName: "Abu",
                dob: "2021-01-21",
                phone: "123"
            },
            selectedFields: {
                fullName: false,
                dob: true,
                phone: true
            },
            setActive: true
        },
        "actor-1",
        { repo }
    );

    assert.deepEqual(calls.deactivated, ["cred-active"]);
    assert.equal(calls.record.isActive, true);
    assert.equal(calls.record.metadata.saveMode, "active");
    assert.equal(result.record.id, "cred-new-active");
});
