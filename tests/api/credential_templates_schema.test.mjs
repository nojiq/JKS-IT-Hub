import test from "node:test";
import assert from "node:assert/strict";
import {
    createTemplateSchema,
    updateTemplateSchema
} from "../../apps/api/src/features/credentials/schema.js";

test("createTemplateSchema accepts valid template payload", () => {
    const payload = {
        name: "Standard Employee Credentials",
        description: "Global default",
        isActive: true,
        structure: {
            systems: ["email", "vpn"],
            fields: [
                { name: "username", ldapSource: "mail", required: true, normalization: ["lowercase", "trim"] },
                { name: "password", type: "generated", pattern: "{firstname:3}{lastname:3}{random:4}", required: true }
            ],
            normalizationRules: { lowercase: true, trim: true, removeSpaces: true }
        }
    };

    const result = createTemplateSchema.safeParse(payload);
    assert.equal(result.success, true);
});

test("createTemplateSchema rejects missing systems and fields", () => {
    const payload = {
        name: "Bad Template",
        structure: {
            systems: [],
            fields: []
        }
    };

    const result = createTemplateSchema.safeParse(payload);
    assert.equal(result.success, false);
});

test("createTemplateSchema rejects field without ldapSource or generated/static type", () => {
    const payload = {
        name: "Bad Field Mapping",
        structure: {
            systems: ["email"],
            fields: [{ name: "username", type: "ldap" }]
        }
    };

    const result = createTemplateSchema.safeParse(payload);
    assert.equal(result.success, false);
});

test("updateTemplateSchema accepts partial update with isActive", () => {
    const payload = { isActive: false };
    const result = updateTemplateSchema.safeParse(payload);
    assert.equal(result.success, true);
});

test("updateTemplateSchema rejects empty payload", () => {
    const payload = {};
    const result = updateTemplateSchema.safeParse(payload);
    assert.equal(result.success, false);
});
