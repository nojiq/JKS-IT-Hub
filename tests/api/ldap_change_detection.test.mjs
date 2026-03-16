import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { createLdapSyncRunner } from "../../apps/api/src/features/ldap/syncService.js";

describe("LDAP Change Detection", () => {
    it("should detect changes and log audit entry when attributes differ", async () => {
        // Setup
        const config = {
            ldapSync: {
                usernameAttribute: "mail",
                attributes: ["displayName", "department"],
                filter: "(objectClass=person)",
                pageSize: 100
            }
        };

        const ldapEntry = {
            dn: "cn=user,dc=example,dc=com",
            mail: "user@example.com",
            displayName: "New Name",
            department: "New Dept"
        };

        const existingUser = {
            id: "user-123",
            username: "user@example.com",
            ldapAttributes: {
                displayName: "Old Name", // Changed
                department: "New Dept",   // Same
                mail: "user@example.com"
            }
        };

        const ldapService = {
            searchEntries: mock.fn(async () => [ldapEntry])
        };

        const userRepo = {
            findUsersByUsernames: mock.fn(async () => [existingUser]),
            // Or if logic changes to fetch individual:
            findUserByUsername: mock.fn(async () => existingUser),
            upsertUserFromLdap: mock.fn(async () => ({ id: "user-123" }))
        };

        const auditRepo = {
            createAuditLog: mock.fn(async () => { })
        };

        const syncRepo = {
            createSyncRun: mock.fn(async () => ({ id: "run-1", status: "started" })),
            updateSyncRun: mock.fn(async () => ({ id: "run-1", status: "completed" })),
            getActiveSyncRun: mock.fn(async () => null),
            getLatestSyncRun: mock.fn(async () => null)
        };

        const eventChannel = { publish: mock.fn() };

        const runner = createLdapSyncRunner({
            config,
            ldapService,
            syncRepo,
            userRepo,
            auditRepo,
            eventChannel
        });

        // Execute
        await runner.startScheduledSync();

        // Assert Audit Log
        // We expect one audit log for the run start
        // AND one audit log for the user update
        // The user update audit log is what we care about.

        const auditCalls = auditRepo.createAuditLog.mock.calls.map(c => c.arguments[0]);
        const updateLog = auditCalls.find(call => call.action === "user.ldap_update");

        assert.ok(updateLog, "Should invoke createAuditLog with user.ldap_update");
        assert.strictEqual(updateLog.actorUserId, null);
        assert.strictEqual(updateLog.entityId, "user-123");

        // Check diff in metadata
        // Expecting: { changes: [{ field: 'displayName', old: 'Old Name', new: 'New Name' }] }
        // Department should NOT be there as it didn't change.
        const changes = updateLog.metadata.changes;
        assert.deepStrictEqual(changes, [
            { field: "displayName", old: "Old Name", new: "New Name" }
        ]);
    });

    it("should ignore identical data and NOT log audit entry", async () => {
        const config = {
            ldapSync: {
                usernameAttribute: "mail",
                attributes: ["displayName", "department"],
                filter: "(objectClass=person)",
                pageSize: 100
            }
        };

        const ldapEntry = {
            dn: "cn=user,dc=example,dc=com",
            mail: "user@example.com",
            displayName: "Same Name",
            department: "Same Dept"
        };

        const existingUser = {
            id: "user-123",
            username: "user@example.com",
            ldapAttributes: {
                displayName: "Same Name",
                department: "Same Dept",
                mail: "user@example.com"
            }
        };

        const ldapService = { searchEntries: mock.fn(async () => [ldapEntry]) };
        const userRepo = {
            findUsersByUsernames: mock.fn(async () => [existingUser]),
            upsertUserFromLdap: mock.fn(async () => ({}))
        };
        const auditRepo = { createAuditLog: mock.fn(async () => { }) };
        const syncRepo = {
            createSyncRun: mock.fn(async () => ({ id: "run-2", status: "started" })),
            updateSyncRun: mock.fn(async () => ({ id: "run-2", status: "completed" })),
            getActiveSyncRun: mock.fn(async () => null),
            getLatestSyncRun: mock.fn(async () => null)
        };
        const eventChannel = { publish: mock.fn() };

        const runner = createLdapSyncRunner({ config, ldapService, syncRepo, userRepo, auditRepo, eventChannel });

        await runner.startScheduledSync();

        const auditCalls = auditRepo.createAuditLog.mock.calls.map(c => c.arguments[0]);
        const updateLog = auditCalls.find(call => call.action === "user.ldap_update");
        assert.ok(!updateLog, "Should NOT invoke createAuditLog with user.ldap_update when data is identical");
        assert.strictEqual(
            userRepo.upsertUserFromLdap.mock.callCount(),
            0,
            "Should skip DB update for unchanged LDAP attributes"
        );
    });

    it("should skip usernames matching exclude regex", async () => {
        const config = {
            ldapSync: {
                usernameAttribute: "sAMAccountName",
                attributes: ["cn", "mail"],
                filter: "(objectClass=person)",
                pageSize: 100,
                excludeUsernameRegex: "^admin-[0-9a-f-]{8,}$"
            }
        };

        const ldapService = {
            searchEntries: mock.fn(async () => [
                {
                    dn: "cn=test-admin,dc=example,dc=com",
                    sAMAccountName: "admin-123e4567-e89b-12d3-a456-426614174000",
                    cn: "Test Admin",
                    mail: "test-admin@example.com"
                },
                {
                    dn: "cn=real-user,dc=example,dc=com",
                    sAMAccountName: "jdoe",
                    cn: "John Doe",
                    mail: "jdoe@example.com"
                }
            ])
        };

        const userRepo = {
            findUsersByUsernames: mock.fn(async () => []),
            findUserByUsername: mock.fn(async () => null),
            upsertUserFromLdap: mock.fn(async () => ({ id: "user-1" }))
        };

        const auditRepo = {
            createAuditLog: mock.fn(async () => { })
        };

        const syncRepo = {
            createSyncRun: mock.fn(async () => ({ id: "run-3", status: "started" })),
            updateSyncRun: mock.fn(async (_id, updates) => ({ id: "run-3", status: "completed", ...updates })),
            getActiveSyncRun: mock.fn(async () => null),
            getLatestSyncRun: mock.fn(async () => null)
        };
        const eventChannel = { publish: mock.fn() };

        const runner = createLdapSyncRunner({ config, ldapService, syncRepo, userRepo, auditRepo, eventChannel });

        await runner.startScheduledSync();

        assert.strictEqual(userRepo.upsertUserFromLdap.mock.callCount(), 1);
        assert.strictEqual(
            userRepo.upsertUserFromLdap.mock.calls[0].arguments[0].username,
            "jdoe"
        );
    });
});
