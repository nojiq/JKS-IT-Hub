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
