import test from "node:test";
import assert from "node:assert/strict";

process.env.CREDENTIAL_ENCRYPTION_KEY ??= "profile-field-test-encryption-key-32-bytes";

const createFakePrisma = ({ initialValues = [] } = {}) => {
  const definitions = [
    {
      id: "def-name",
      fieldKey: "name",
      label: "Name",
      fieldType: "text",
      required: true,
      sensitive: false,
      isActive: true,
      sortOrder: 10
    },
    {
      id: "def-actual-password",
      fieldKey: "actual-password",
      label: "Actual Password",
      fieldType: "password",
      required: false,
      sensitive: true,
      isActive: true,
      sortOrder: 20
    },
    {
      id: "def-temporary-password",
      fieldKey: "temporary-password",
      label: "Temporary Password",
      fieldType: "password",
      required: false,
      sensitive: true,
      isActive: true,
      sortOrder: 30
    }
  ];
  const values = new Map(initialValues.map((row) => [row.id, { ...row }]));

  const findDefinition = (id) => definitions.find((definition) => definition.id === id);
  const nextId = (userId, fieldDefinitionId) => `${userId}-${fieldDefinitionId}`;

  const prismaClient = {
    userFieldDefinition: {
      findMany: async (args = {}) => {
        const activeDefinitions = definitions.filter((definition) => (
          args.where?.isActive === undefined || definition.isActive === args.where.isActive
        ));

        if (args.include?.values) {
          const userId = args.include.values.where.userId;
          return activeDefinitions.map((definition) => ({
            ...definition,
            values: [...values.values()]
              .filter((row) => row.userId === userId && row.fieldDefinitionId === definition.id)
              .slice(0, args.include.values.take ?? undefined)
          }));
        }

        return activeDefinitions.map((definition) => ({ ...definition }));
      }
    },
    userFieldValue: {
      upsert: async ({ where, update, create }) => {
        const { userId, fieldDefinitionId } = where.userId_fieldDefinitionId;
        const existing = [...values.values()].find((row) => (
          row.userId === userId && row.fieldDefinitionId === fieldDefinitionId
        ));
        if (existing) {
          Object.assign(existing, update);
          return { ...existing };
        }

        const row = {
          id: nextId(create.userId, create.fieldDefinitionId),
          ...create
        };
        values.set(row.id, row);
        return { ...row };
      },
      findMany: async (args = {}) => {
        let rows = [...values.values()];
        if (args.where?.userId) {
          rows = rows.filter((row) => row.userId === args.where.userId);
        }
        if (args.where?.fieldDefinition?.sensitive !== undefined) {
          rows = rows.filter((row) => (
            findDefinition(row.fieldDefinitionId)?.sensitive === args.where.fieldDefinition.sensitive
          ));
        }

        if (args.include?.fieldDefinition) {
          rows = rows.map((row) => ({
            ...row,
            fieldDefinition: findDefinition(row.fieldDefinitionId)
          }));
        }

        if (args.select) {
          rows = rows.map((row) => Object.fromEntries(
            Object.entries(args.select)
              .filter(([, enabled]) => enabled)
              .map(([key]) => [key, row[key]])
          ));
        }

        return rows.map((row) => ({ ...row }));
      },
      update: async ({ where, data }) => {
        const row = values.get(where.id);
        Object.assign(row, data);
        return { ...row };
      }
    },
    $transaction: async (callback) => callback(prismaClient),
    rawValues: values,
    definitions
  };

  return prismaClient;
};

test("profile field repo encrypts sensitive values while preserving API plaintext behavior", async () => {
  const { createProfileFieldsRepo } = await import("../../apps/api/src/features/users/profileFieldsRepo.js");
  const prismaClient = createFakePrisma();
  const repo = createProfileFieldsRepo({ prismaClient });

  const updatedFields = await repo.updateProfileFieldValues({
    userId: "user-1",
    updatedBy: "it-1",
    values: {
      name: "Abdullah Fauzi",
      "actual-password": "Secret123!"
    }
  });

  const rawName = [...prismaClient.rawValues.values()].find((row) => row.fieldDefinitionId === "def-name");
  const rawPassword = [...prismaClient.rawValues.values()].find((row) => row.fieldDefinitionId === "def-actual-password");

  assert.equal(rawName.value, "Abdullah Fauzi");
  assert.match(rawPassword.value, /^enc:v1:/);
  assert.notEqual(rawPassword.value, "Secret123!");
  assert.equal(updatedFields.find((field) => field.key === "actual-password").value, "Secret123!");

  const visibleFields = await repo.listProfileFieldsForUser("user-1", { includeSensitive: true });
  assert.equal(visibleFields.find((field) => field.key === "actual-password").value, "Secret123!");

  const hiddenFields = await repo.listProfileFieldsForUser("user-1", { includeSensitive: false });
  assert.equal(hiddenFields.find((field) => field.key === "actual-password").value, null);
});

test("profile field repo does not double-encrypt existing encrypted values and leaves empty sensitive values empty", async () => {
  const { createProfileFieldsRepo } = await import("../../apps/api/src/features/users/profileFieldsRepo.js");
  const { encryptSecret } = await import("../../apps/api/src/shared/security/secretEncryption.js");
  const prismaClient = createFakePrisma();
  const repo = createProfileFieldsRepo({ prismaClient });
  const encryptedValue = encryptSecret("AlreadyEncrypted!");

  await repo.updateProfileFieldValues({
    userId: "user-1",
    updatedBy: "it-1",
    values: {
      "actual-password": encryptedValue,
      "temporary-password": ""
    }
  });

  const rawActual = [...prismaClient.rawValues.values()].find((row) => row.fieldDefinitionId === "def-actual-password");
  const rawTemporary = [...prismaClient.rawValues.values()].find((row) => row.fieldDefinitionId === "def-temporary-password");

  assert.equal(rawActual.value, encryptedValue);
  assert.equal(rawTemporary.value, "");
});

test("sensitive profile-field backfill supports dry-run, apply, and idempotent re-run", async () => {
  const { encryptSecret } = await import("../../apps/api/src/shared/security/secretEncryption.js");
  const {
    getSensitiveProfileFieldValueStats,
    encryptSensitiveProfileFieldValues
  } = await import("../../apps/api/scripts/encrypt-sensitive-profile-fields.mjs");
  const alreadyEncrypted = encryptSecret("ExistingSecret!");
  const prismaClient = createFakePrisma({
    initialValues: [
      {
        id: "plain-sensitive",
        userId: "user-1",
        fieldDefinitionId: "def-actual-password",
        value: "PlainSecret!"
      },
      {
        id: "encrypted-sensitive",
        userId: "user-2",
        fieldDefinitionId: "def-actual-password",
        value: alreadyEncrypted
      },
      {
        id: "empty-sensitive",
        userId: "user-3",
        fieldDefinitionId: "def-temporary-password",
        value: ""
      },
      {
        id: "plain-non-sensitive",
        userId: "user-4",
        fieldDefinitionId: "def-name",
        value: "Plain Name"
      }
    ]
  });

  const before = await getSensitiveProfileFieldValueStats(prismaClient);
  assert.deepEqual(before, {
    totalSensitiveRows: 3,
    alreadyEncryptedCount: 1,
    plaintextCount: 1,
    emptyCount: 1
  });
  assert.equal(prismaClient.rawValues.get("plain-sensitive").value, "PlainSecret!");

  const applied = await encryptSensitiveProfileFieldValues(prismaClient);
  assert.equal(applied.updatedCount, 1);
  assert.equal(applied.remainingPlaintextCount, 0);
  assert.match(prismaClient.rawValues.get("plain-sensitive").value, /^enc:v1:/);
  assert.equal(prismaClient.rawValues.get("encrypted-sensitive").value, alreadyEncrypted);
  assert.equal(prismaClient.rawValues.get("empty-sensitive").value, "");
  assert.equal(prismaClient.rawValues.get("plain-non-sensitive").value, "Plain Name");

  const secondApply = await encryptSensitiveProfileFieldValues(prismaClient);
  assert.equal(secondApply.updatedCount, 0);
  assert.equal(secondApply.remainingPlaintextCount, 0);
});
