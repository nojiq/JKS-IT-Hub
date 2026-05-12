import { prisma } from "../../shared/db/prisma.js";

const mapField = (definition, valueRow = null, { includeSensitive = true } = {}) => ({
  id: definition.id,
  key: definition.fieldKey,
  label: definition.label,
  type: definition.fieldType,
  required: definition.required,
  sensitive: definition.sensitive,
  value: definition.sensitive && !includeSensitive ? null : (valueRow?.value ?? ""),
  source: valueRow ? "manual" : null
});

export const listProfileFieldsForUser = async (userId, options = {}) => {
  const definitions = await prisma.userFieldDefinition.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    include: {
      values: {
        where: { userId },
        take: 1
      }
    }
  });

  return definitions.map((definition) => mapField(definition, definition.values[0] ?? null, options));
};

export const updateProfileFieldValues = async ({ userId, values, updatedBy }) => {
  const requestedValues = values && typeof values === "object" && !Array.isArray(values) ? values : null;
  if (!requestedValues) {
    const error = new Error("values must be an object keyed by field key");
    error.code = "INVALID_PROFILE_FIELDS";
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const definitions = await tx.userFieldDefinition.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
    });
    const definitionsByKey = new Map(definitions.map((definition) => [definition.fieldKey, definition]));
    const unknownKeys = Object.keys(requestedValues).filter((key) => !definitionsByKey.has(key));

    if (unknownKeys.length) {
      const error = new Error(`Unknown profile field: ${unknownKeys.join(", ")}`);
      error.code = "UNKNOWN_PROFILE_FIELD";
      error.unknownKeys = unknownKeys;
      throw error;
    }

    for (const [key, rawValue] of Object.entries(requestedValues)) {
      const definition = definitionsByKey.get(key);
      const value = rawValue === null || rawValue === undefined ? "" : String(rawValue);

      await tx.userFieldValue.upsert({
        where: {
          userId_fieldDefinitionId: {
            userId,
            fieldDefinitionId: definition.id
          }
        },
        update: {
          value,
          updatedBy
        },
        create: {
          userId,
          fieldDefinitionId: definition.id,
          value,
          updatedBy
        }
      });
    }

    const updatedValues = await tx.userFieldValue.findMany({
      where: { userId },
      select: {
        fieldDefinitionId: true,
        value: true
      }
    });
    const valuesByDefinitionId = new Map(updatedValues.map((value) => [value.fieldDefinitionId, value]));

    return definitions.map((definition) => mapField(definition, valuesByDefinitionId.get(definition.id) ?? null));
  });
};
