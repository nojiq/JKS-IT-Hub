import test from "node:test";
import assert from "node:assert/strict";

import {
    generateCredentials,
    MissingLdapFieldsError
} from "../../apps/api/src/features/credentials/generator.js";

test("generator is deterministic when no password pattern is provided", () => {
    const template = {
        version: 3,
        structure: {
            systems: ["email"],
            fields: [
                { name: "username", ldapSource: "mail", required: true },
                { name: "password" }
            ],
            normalizationRules: { lowercase: true, trim: true }
        }
    };

    const user = {
        id: "user-123",
        ldapAttributes: {
            mail: "John.Doe@Company.com",
            givenName: "John",
            sn: "Doe"
        }
    };

    const first = generateCredentials(template, user);
    const second = generateCredentials(template, user);

    assert.equal(first[0].password, second[0].password);
});

test("generator parses {random:N} correctly and remains deterministic", () => {
    const template = {
        version: 5,
        structure: {
            systems: ["vpn"],
            fields: [
                { name: "username", ldapSource: "mail", required: true },
                { name: "givenName", ldapSource: "givenName", required: true },
                { name: "password", pattern: "{givenName:3}{random:4}" }
            ],
            normalizationRules: { trim: true }
        }
    };

    const user = {
        id: "user-456",
        ldapAttributes: {
            mail: "jane.smith@company.com",
            givenName: "Jane",
            sn: "Smith"
        }
    };

    const first = generateCredentials(template, user);
    const second = generateCredentials(template, user);

    assert.equal(first[0].password, second[0].password);
    assert.match(first[0].password, /^Jan[A-Za-z0-9]{4}$/);
});

test("generator reports required missing LDAP fields", () => {
    const template = {
        version: 1,
        structure: {
            systems: ["email"],
            fields: [
                { name: "username", ldapSource: "mail", required: true },
                { name: "password", pattern: "{random:8}" }
            ]
        }
    };

    const user = {
        id: "user-789",
        ldapAttributes: {}
    };

    assert.throws(
        () => generateCredentials(template, user),
        (error) => {
            assert.ok(error instanceof MissingLdapFieldsError);
            assert.equal(error.code, "MISSING_LDAP_FIELDS");
            assert.deepEqual(error.missingFields, ["mail"]);
            return true;
        }
    );
});
