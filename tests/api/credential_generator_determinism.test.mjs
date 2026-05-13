import test from "node:test";
import assert from "node:assert/strict";

import * as credentialGenerator from "../../apps/api/src/features/credentials/generator.js";

const {
    generateCredentials,
    MissingLdapFieldsError,
    generateActualDeterministicPassword
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

test("IMAP deterministic generator accepts stable subjectKey input", () => {
    const baseInput = {
        subjectKey: "manual:abu|abu@example.com",
        username: "abu@example.com",
        inputs: {
            email: "abu@example.com",
            firstName: "Abu",
            lastName: "Bakar",
            fullName: "Abu",
            dob: "2021-01-21",
            phone: "123"
        },
        selectedFields: {
            email: false,
            firstName: false,
            lastName: false,
            fullName: false,
            dob: true,
            phone: true
        },
        origins: {
            dob: "manual",
            phone: "manual"
        }
    };

    const first = credentialGenerator.generateImapDeterministicPassword(baseInput);
    const second = credentialGenerator.generateImapDeterministicPassword({
        ...baseInput,
        inputs: {
            phone: "123",
            dob: "2021-01-21",
            fullName: "Abu",
            lastName: "Bakar",
            firstName: "Abu",
            email: "abu@example.com"
        },
        selectedFields: {
            phone: true,
            dob: true,
            fullName: false,
            lastName: false,
            firstName: false,
            email: false
        }
    });

    const changed = credentialGenerator.generateImapDeterministicPassword({
        ...baseInput,
        inputs: {
            ...baseInput.inputs,
            phone: "999"
        }
    });

    const reverted = credentialGenerator.generateImapDeterministicPassword(baseInput);

    assert.equal(first.password, second.password);
    assert.notEqual(first.password, changed.password);
    assert.equal(first.password, reverted.password);
    assert.equal(first.metadata.subjectKey, "manual:abu|abu@example.com");
});

test("IMAP deterministic generator changes when selected Yahoo temporary password changes", () => {
    const baseInput = {
        subjectKey: "manual:haziq|haziq.afendi@jkseng.com",
        username: "haziq.afendi@jkseng.com",
        inputs: {
            email: "haziq.afendi@jkseng.com",
            fullName: "Haziq Afendi",
            dob: "1995-06-15",
            temporaryPassword: "TempYahoo#1"
        },
        selectedFields: {
            email: true,
            fullName: true,
            dob: true,
            temporaryPassword: true
        },
        origins: {
            email: "manual",
            fullName: "manual",
            dob: "manual",
            temporaryPassword: "manual"
        }
    };

    const first = credentialGenerator.generateImapDeterministicPassword(baseInput);
    const changed = credentialGenerator.generateImapDeterministicPassword({
        ...baseInput,
        inputs: {
            ...baseInput.inputs,
            temporaryPassword: "TempYahoo#2"
        }
    });
    const reverted = credentialGenerator.generateImapDeterministicPassword(baseInput);

    assert.notEqual(first.password, changed.password);
    assert.equal(first.password, reverted.password);
    assert.deepEqual(first.metadata.selectedFields, ["dob", "email", "fullName", "temporaryPassword"]);
});

test("Yahoo actual password is deterministic for same inputs and charset options", () => {
    const charset = { uppercase: true, lowercase: true, digit: true, special: true };
    const base = {
        fullName: "Abu Bakar",
        email: "Abu@Example.COM",
        dob: "1990-05-12",
        temporaryPassword: "Temp#1",
        length: 12,
        charset
    };
    const a = generateActualDeterministicPassword(base);
    const b = generateActualDeterministicPassword({
        ...base,
        fullName: "abu bakar"
    });
    assert.equal(a.password, b.password);
    assert.equal(a.password.length, 12);
    assert.equal(a.metadata.mode, "yahoo_actual");
    assert.equal(a.metadata.algorithmVersion, 1);
});

test("Yahoo actual password matches for DOB as ISO date input vs dd/mm/yyyy same calendar day", () => {
    const charset = { uppercase: true, lowercase: true, digit: true, special: true };
    const base = {
        fullName: "haziq.afendi",
        email: "haziq.afendi@jkseng.com",
        temporaryPassword: "",
        length: 12,
        charset
    };
    const iso = generateActualDeterministicPassword({ ...base, dob: "1998-04-30" });
    const dayFirst = generateActualDeterministicPassword({ ...base, dob: "30/04/1998" });
    assert.equal(iso.password, dayFirst.password);
});

test("Yahoo actual password reverts when identity fields revert", () => {
    const charset = { uppercase: true, lowercase: true, digit: true, special: false };
    const first = generateActualDeterministicPassword({
        fullName: "Abu",
        email: "abu@example.com",
        dob: "2000-01-01",
        temporaryPassword: "x",
        length: 12,
        charset
    });
    const changed = generateActualDeterministicPassword({
        fullName: "Ali",
        email: "abu@example.com",
        dob: "2000-01-01",
        temporaryPassword: "x",
        length: 12,
        charset
    });
    const back = generateActualDeterministicPassword({
        fullName: "Abu",
        email: "abu@example.com",
        dob: "2000-01-01",
        temporaryPassword: "x",
        length: 12,
        charset
    });
    assert.notEqual(first.password, changed.password);
    assert.equal(first.password, back.password);
});

test("Yahoo actual password includes each enabled character class when length allows", () => {
    const charset = { uppercase: true, lowercase: true, digit: true, special: true };
    const { password } = generateActualDeterministicPassword({
        fullName: "n",
        email: "n@n.co",
        dob: "1",
        temporaryPassword: "t",
        length: 10,
        charset
    });
    assert.match(password, /[A-Z]/);
    assert.match(password, /[a-z]/);
    assert.match(password, /[0-9]/);
    assert.match(password, /[!@#$%^&*\-_+=]/);
});
