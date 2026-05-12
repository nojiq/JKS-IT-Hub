import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/it_hub_test";

const {
  detectChanges,
  buildCredentialComparison,
  mapRegenerationReason,
  DisabledUserError,
  NoChangesDetectedError
} = await import("../../apps/api/src/features/credentials/service.js");

test("detectChanges reports template version change without forcing ldapChanged", () => {
  const result = detectChanges(
    { id: "user-1", ldapAttributes: { mail: "user@company.com" } },
    [{ templateVersion: 2 }],
    { version: 3 }
  );

  assert.equal(result.templateChanged, true);
  assert.equal(result.oldTemplateVersion, 2);
  assert.equal(result.newTemplateVersion, 3);
  assert.equal(result.ldapChanged, false);
});

test("detectChanges marks initial generation when no existing credentials", () => {
  const result = detectChanges(
    { id: "user-1", ldapAttributes: {} },
    [],
    { version: 1 }
  );

  assert.equal(result.ldapChanged, true);
  assert.equal(result.templateChanged, false);
});

test("detectChanges collects known LDAP sources from stored metadata", () => {
  const result = detectChanges(
    { id: "user-1", ldapAttributes: { mail: "user@company.com" } },
    [
      {
        templateVersion: 1,
        ldapSources: {
          username: "mail",
          displayName: "cn"
        }
      }
    ],
    { version: 1 }
  );

  assert.deepEqual(result.changedLdapFields.sort(), ["cn", "mail"]);
  assert.equal(result.ldapChanged, false);
});

test("buildCredentialComparison never marks rows skipped after lock removal", () => {
  const result = buildCredentialComparison(
    [
      { system: "email", username: "u1", password: "p1" },
      { system: "vpn", username: "u2", password: "p2" }
    ],
    [
      { system: "email", username: "u1", password: "p3" },
      { system: "vpn", username: "u2", password: "p4" }
    ],
    {}
  );

  const vpn = result.find((entry) => entry.system === "vpn");
  assert.equal(vpn.skipped, false);
  assert.equal(vpn.skipReason, null);
});

test("mapRegenerationReason maps change type to AC-compliant reason values", () => {
  assert.equal(mapRegenerationReason("ldap_update"), "ldap_update");
  assert.equal(mapRegenerationReason("template_change"), "template_change");
  assert.equal(mapRegenerationReason("both"), "template_change");
});

test("error classes expose stable metadata", () => {
  const disabled = new DisabledUserError("user-123");
  assert.equal(disabled.code, "DISABLED_USER");
  assert.equal(disabled.userId, "user-123");

  const noChanges = new NoChangesDetectedError("user-456", "2026-02-09T00:00:00.000Z");
  assert.equal(noChanges.code, "NO_CHANGES_DETECTED");
  assert.equal(noChanges.userId, "user-456");
  assert.equal(noChanges.lastGeneratedAt, "2026-02-09T00:00:00.000Z");
});
