import test from "node:test";
import assert from "node:assert/strict";

import {
  firstString,
  getLdapDepartment,
  getLdapEmail,
  normalizeOrgName
} from "../../apps/api/src/features/pulse-org/normalizer.js";
import { createPulseOrgClient } from "../../apps/api/src/features/pulse-org/client.js";

const createFakeMongo = ({ users = [], departments = [], divisions = [], sections = [] } = {}) => {
  const collections = { users, departments, divisions, sections };
  const fake = { connectCalls: 0 };
  const findOne = async (items, query) => {
    if (query.$or) {
      return items.find((item) => query.$or.some((condition) => matches(item, condition))) ?? null;
    }
    return items.find((item) => matches(item, query)) ?? null;
  };
  const matches = (item, query) => Object.entries(query).every(([field, expected]) => {
    const actual = item[field];
    if (expected instanceof RegExp) {
      return expected.test(String(actual ?? ""));
    }
    return actual === expected;
  });
  const createFindChain = (items) => ({
    project: () => createFindChain(items),
    sort: () => createFindChain(items),
    toArray: async () => [...items]
  });
  fake.client = {
      connect: async () => {
        fake.connectCalls += 1;
      },
      db: () => ({
        collection: (name) => ({
          findOne: (query) => findOne(collections[name] ?? [], query),
          find: () => createFindChain(collections[name] ?? [])
        })
      })
    };
  return fake;
};

test("normalizes org names and LDAP scalar values", () => {
  assert.equal(normalizeOrgName(" HR & Admin "), "HR AND ADMIN");
  assert.equal(normalizeOrgName("Facilities   & Safety"), "FACILITIES AND SAFETY");
  assert.equal(firstString(["", "a@jks.com"]), "a@jks.com");
  assert.equal(getLdapEmail({ mail: ["a@jks.com"] }), "a@jks.com");
  assert.equal(getLdapDepartment({ dept: "IT" }), "IT");
});

test("returns null when Pulse org sync is disabled", async () => {
  const client = createPulseOrgClient({
    config: { enabled: false },
    mongoClientFactory: () => {
      throw new Error("should not connect");
    }
  });

  assert.equal(await client.resolveForLdapUser({ username: "jane", ldapAttributes: { mail: "jane@jks.com" } }), null);
});

test("resolves org snapshot by exact email match", async () => {
  const fake = createFakeMongo({
    users: [{ email: "jane@jks.com", division: "CORPORATE SERVICES", department: "IT", section: "INFRASTRUCTURE" }],
    divisions: [{ _id: "div-1", name: "CORPORATE SERVICES" }],
    departments: [{ _id: "dept-1", code: "IT", name: "IT", divisionId: "div-1" }],
    sections: [{ _id: "sec-1", name: "INFRASTRUCTURE", departmentId: "dept-1" }]
  });
  const client = createPulseOrgClient({
    config: { enabled: true, mongoUri: "mongodb://localhost:27017/jkspulse", database: "jkspulse", timeoutMs: 10 },
    mongoClientFactory: () => fake.client
  });

  assert.deepEqual(await client.resolveForLdapUser({
    username: "jane",
    ldapAttributes: { mail: "jane@jks.com", department: "Legacy" }
  }), {
    source: "jkspulse",
    division: { id: "div-1", name: "CORPORATE SERVICES" },
    department: { id: "dept-1", code: "IT", name: "IT" },
    section: { id: "sec-1", name: "INFRASTRUCTURE" },
    matchedBy: "email",
    confidence: "exact"
  });
});

test("resolves org snapshot by username email prefix", async () => {
  const fake = createFakeMongo({
    users: [{ email: "ali@jks.com", division: "OPERATIONS", department: "PRODUCTION", section: "" }],
    divisions: [{ _id: "div-2", name: "OPERATIONS" }],
    departments: [{ _id: "dept-2", code: "PRO", name: "PRODUCTION", divisionId: "div-2" }]
  });
  const client = createPulseOrgClient({
    config: { enabled: true, mongoUri: "mongodb://localhost:27017/jkspulse", database: "jkspulse", timeoutMs: 10 },
    mongoClientFactory: () => fake.client
  });

  assert.deepEqual(await client.resolveForLdapUser({
    username: "ali",
    ldapAttributes: { mail: "different@jks.com" }
  }), {
    source: "jkspulse",
    division: { id: "div-2", name: "OPERATIONS" },
    department: { id: "dept-2", code: "PRO", name: "PRODUCTION" },
    section: null,
    matchedBy: "username",
    confidence: "exact"
  });
});

test("falls back to LDAP department name match", async () => {
  const fake = createFakeMongo({
    divisions: [{ _id: "div-3", name: "CORPORATE SERVICES" }],
    departments: [{ _id: "dept-3", code: "HRA", name: "HR & ADMIN", divisionId: "div-3" }]
  });
  const client = createPulseOrgClient({
    config: { enabled: true, mongoUri: "mongodb://localhost:27017/jkspulse", database: "jkspulse", timeoutMs: 10 },
    mongoClientFactory: () => fake.client
  });

  assert.deepEqual(await client.resolveForLdapUser({
    username: "unknown",
    ldapAttributes: { department: "HR and Admin" }
  }), {
    source: "jkspulse",
    division: { id: "div-3", name: "CORPORATE SERVICES" },
    department: { id: "dept-3", code: "HRA", name: "HR & ADMIN" },
    section: null,
    matchedBy: "department",
    confidence: "normalized"
  });
});

test("returns null when no Pulse match exists", async () => {
  const fake = createFakeMongo();
  const client = createPulseOrgClient({
    config: { enabled: true, mongoUri: "mongodb://localhost:27017/jkspulse", database: "jkspulse", timeoutMs: 10 },
    mongoClientFactory: () => fake.client
  });

  assert.equal(await client.resolveForLdapUser({
    username: "missing",
    ldapAttributes: { mail: "missing@jks.com", department: "Missing" }
  }), null);
});

test("listOrgHierarchy returns empty when Pulse is disabled", async () => {
  const client = createPulseOrgClient({
    config: { enabled: false },
    mongoClientFactory: () => {
      throw new Error("should not connect");
    }
  });

  assert.deepEqual(await client.listOrgHierarchy(), {
    enabled: false,
    divisions: [],
    departments: [],
    sections: []
  });
});

test("listOrgHierarchy returns sorted divisions, departments, and sections", async () => {
  const fake = createFakeMongo({
    divisions: [
      { _id: "div-a", name: "A-Div" },
      { _id: "div-b", name: "B-Div" }
    ],
    departments: [
      { _id: "dept-1", name: "A-Dept", divisionId: "div-a" },
      { _id: "dept-2", name: "Z-Dept", divisionId: "div-a", code: "Z" }
    ],
    sections: [
      { _id: "sec-1", name: "A-Sec", departmentId: "dept-1" },
      { _id: "sec-2", name: "B-Sec", departmentId: "dept-1" }
    ]
  });
  const client = createPulseOrgClient({
    config: { enabled: true, mongoUri: "mongodb://localhost:27017/jkspulse", database: "jkspulse", timeoutMs: 10 },
    mongoClientFactory: () => fake.client
  });

  const hierarchy = await client.listOrgHierarchy();
  assert.equal(hierarchy.enabled, true);
  assert.deepEqual(
    hierarchy.divisions.map((d) => d.name),
    ["A-Div", "B-Div"]
  );
  assert.deepEqual(
    hierarchy.departments.map((d) => d.name),
    ["A-Dept", "Z-Dept"]
  );
  assert.equal(hierarchy.departments[0].divisionId, "div-a");
  assert.equal(hierarchy.departments[0].code, undefined);
  assert.equal(hierarchy.departments[1].code, "Z");
  assert.deepEqual(
    hierarchy.sections.map((s) => s.name),
    ["A-Sec", "B-Sec"]
  );
  assert.equal(hierarchy.sections[0].departmentId, "dept-1");
});
