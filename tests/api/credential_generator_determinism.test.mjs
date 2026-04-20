import test from "node:test";
import assert from "node:assert/strict";

import * as credentialGenerator from "../../apps/api/src/features/credentials/generator.js";

const {
    generateCredentials,
    MissingLdapFieldsError
} = credentialGenerator;

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

test("IMAP deterministic generator is stable across same inputs and toggles", () => {
    const result = credentialGenerator.generateImapDeterministicPassword({
        userId: "user-123",
        username: "john.doe@company.com",
        inputs: {
            email: "John.Doe@Company.com ",
            firstName: "John",
            lastName: "Doe",
            fullName: "John Doe",
            dob: "1990-01-01",
            phone: "012-345 6789"
        },
        selectedFields: {
            email: true,
            firstName: false,
            lastName: true,
            fullName: false,
            dob: true,
            phone: true
        },
        origins: {
            email: "ldap",
            lastName: "ldap",
            dob: "manual",
            phone: "manual"
        }
    });

    const second = credentialGenerator.generateImapDeterministicPassword({
        userId: "user-123",
        username: "john.doe@company.com",
        inputs: {
            phone: "012-345 6789",
            dob: "1990-01-01",
            fullName: "John Doe",
            lastName: "Doe",
            firstName: "John",
            email: "john.doe@company.com"
        },
        selectedFields: {
            phone: true,
            dob: true,
            fullName: false,
            lastName: true,
            firstName: false,
            email: true
        },
        origins: {
            phone: "manual",
            dob: "manual",
            lastName: "ldap",
            email: "ldap"
        }
    });

    assert.equal(result.password, second.password);
    assert.deepEqual(result.metadata.selectedFields, ["dob", "email", "lastName", "phone"]);
    assert.deepEqual(result.metadata.changedFields, []);
});

test("IMAP deterministic generator changes password when selected input changes and restores on revert", () => {
    const base = {
        userId: "user-123",
        username: "john.doe@company.com",
        inputs: {
            email: "john.doe@company.com",
            firstName: "John",
            lastName: "Doe",
            fullName: "John Doe",
            dob: "1990-01-01",
            phone: "0123456789"
        },
        selectedFields: {
            email: true,
            firstName: false,
            lastName: false,
            fullName: false,
            dob: true,
            phone: true
        },
        origins: {
            email: "ldap",
            dob: "manual",
            phone: "manual"
        }
    };

    const first = credentialGenerator.generateImapDeterministicPassword(base);
    const changed = credentialGenerator.generateImapDeterministicPassword({
        ...base,
        inputs: {
            ...base.inputs,
            phone: "0199999999"
        }
    });
    const reverted = credentialGenerator.generateImapDeterministicPassword(base);

    assert.notEqual(first.password, changed.password);
    assert.equal(first.password, reverted.password);
});
