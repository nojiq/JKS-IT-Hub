import "./bootstrap-database-env.mjs";
import test from "node:test";
import assert from "node:assert/strict";

import {
    upsertUserImapProfile,
    createImapCredentialRecord,
    listImapCredentialRecords
} from "../../apps/api/src/features/credentials/repo.js";
import { loadImapWorkbench, saveImapPassword } from "../../apps/api/src/features/credentials/imap/service.js";
import * as credentialService from "../../apps/api/src/features/credentials/service.js";

test("credential service exports IMAP provider record handlers", () => {
    assert.equal(typeof credentialService.loadImapWorkbench, "function");
    assert.equal(typeof credentialService.saveImapPassword, "function");
    assert.equal(typeof credentialService.listPreviousImapPasswords, "function");
    assert.equal(credentialService.previewImapPassword, undefined);
    assert.equal(credentialService.applyImapConflictResolution, undefined);
});

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
                mode: "provider_recorded",
                saveMode: "history_only"
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

test("listImapCredentialRecords loads active and archived IMAP rows", async () => {
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
                        isActive: true
                    },
                    {
                        id: "cred-old",
                        userId: "user-1",
                        systemId: "imap",
                        isActive: false
                    }
                ];
            }
        }
    };

    const result = await listImapCredentialRecords("user-1", tx);
    assert.equal(findManyArgs.where.systemId, "imap");
    assert.equal(result.length, 2);
});

test("loadImapWorkbench returns user, active credential, and history count", async () => {
    const repo = {
        getUserById: async (id) => ({
            id,
            username: "u1",
            status: "active",
            ldapAttributes: { mail: "u1@example.com" }
        }),
        getUserCredentialBySystem: async () => ({
            id: "c1",
            username: "u1@example.com",
            password: "x",
            systemId: "imap"
        }),
        listImapCredentialRecords: async () => ([{ id: "a" }, { id: "b" }])
    };

    const result = await loadImapWorkbench("user-1", { repo });
    assert.equal(result.user.id, "user-1");
    assert.equal(result.activeCredential.id, "c1");
    assert.equal(result.previousPasswordsCount, 2);
    assert.equal(result.fields, undefined);
});

test("saveImapPassword stores provider password without touching imap profile", async () => {
    const calls = { deactivate: 0, create: 0, upsertProfile: 0 };
    const repo = {
        getUserById: async (id) => ({
            id,
            username: "u1",
            status: "active",
            ldapAttributes: { mail: "from-ldap@example.com" }
        }),
        getUserCredentialBySystem: async () => null,
        getUserCredentialById: async () => null,
        deactivateUserCredential: async () => {
            calls.deactivate += 1;
        },
        createImapCredentialRecord: async (data) => {
            calls.create += 1;
            assert.equal(data.metadata.mode, "provider_recorded");
            assert.equal(data.password, "Prov#Secret1");
            assert.equal(data.username, "custom@example.com");
            return { id: "new-cred", ...data };
        },
        upsertUserImapProfile: async () => {
            calls.upsertProfile += 1;
        }
    };

    const result = await saveImapPassword(
        {
            userId: "user-1",
            username: "custom@example.com",
            password: "Prov#Secret1",
            setActive: true
        },
        "actor-1",
        { repo }
    );

    assert.equal(calls.create, 1);
    assert.equal(calls.deactivate, 0);
    assert.equal(calls.upsertProfile, 0);
    assert.equal(result.record.id, "new-cred");
});

test("saveImapPassword defaults username from LDAP mail when omitted", async () => {
    const repo = {
        getUserById: async (id) => ({
            id,
            username: "u1",
            status: "active",
            ldapAttributes: { mail: ["Alias@Example.com", "primary@example.com"] }
        }),
        getUserCredentialBySystem: async () => null,
        getUserCredentialById: async () => null,
        deactivateUserCredential: async () => {},
        createImapCredentialRecord: async (data) => {
            assert.equal(data.username, "Alias@Example.com");
            return { id: "c", ...data };
        }
    };

    await saveImapPassword(
        { userId: "user-1", password: "SecretFromHost" },
        "actor-1",
        { repo }
    );
});

test("saveImapPassword restore path copies archived credential", async () => {
    const repo = {
        getUserById: async (id) => ({ id, username: "u1", status: "active", ldapAttributes: {} }),
        getUserCredentialBySystem: async () => ({
            id: "active-1",
            templateVersion: 2,
            username: "old@example.com",
            password: "old"
        }),
        getUserCredentialById: async (id) =>
            id === "arch-1"
                ? {
                    id: "arch-1",
                    userId: "user-1",
                    systemId: "imap",
                    username: "restored@example.com",
                    password: "restored-pass",
                    metadata: {}
                }
                : null,
        deactivateUserCredential: async () => {},
        createImapCredentialRecord: async (data) => {
            assert.equal(data.password, "restored-pass");
            assert.equal(data.username, "restored@example.com");
            assert.equal(data.metadata.restoredFrom, "arch-1");
            return { id: "new", ...data };
        }
    };

    await saveImapPassword(
        {
            userId: "user-1",
            restoreCredentialId: "arch-1",
            setActive: true
        },
        "actor-1",
        { repo }
    );
});
