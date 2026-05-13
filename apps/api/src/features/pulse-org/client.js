import { MongoClient } from "mongodb";
import { getLdapDepartment, getLdapEmail, normalizeOrgName } from "./normalizer.js";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const orgNameRegex = (value) => {
  const normalized = normalizeOrgName(value);
  if (!normalized) {
    return null;
  }
  const parts = normalized.split(" ").map((part) => (part === "AND" ? "(?:&|AND)" : escapeRegex(part)));
  return new RegExp(`^\\s*${parts.join("\\s+")}\\s*$`, "i");
};

const toOrgRef = (entry, includeCode = false) => {
  if (!entry) {
    return null;
  }
  return {
    id: entry._id,
    ...(includeCode ? { code: entry.code ?? null } : {}),
    name: entry.name
  };
};

const createDefaultMongoClient = (uri, timeoutMs) =>
  new MongoClient(uri, {
    serverSelectionTimeoutMS: timeoutMs,
    connectTimeoutMS: timeoutMs
  });

export const createPulseOrgClient = ({ config = {}, logger, mongoClientFactory } = {}) => {
  let client = null;
  let db = null;
  let warnedMissingUri = false;

  const isEnabled = () => Boolean(config.enabled);

  const getDb = async () => {
    if (!isEnabled()) {
      return null;
    }
    if (!config.mongoUri) {
      if (!warnedMissingUri) {
        logger?.warn?.("Pulse org sync enabled without PULSE_MONGO_URI; skipping org enrichment");
        warnedMissingUri = true;
      }
      return null;
    }
    if (db) {
      return db;
    }

    client = mongoClientFactory
      ? mongoClientFactory(config.mongoUri, { timeoutMs: config.timeoutMs })
      : createDefaultMongoClient(config.mongoUri, config.timeoutMs ?? 2000);
    await client.connect();
    db = client.db(config.database ?? "jkspulse");
    return db;
  };

  const findByName = async (database, collectionName, name) => {
    const regex = orgNameRegex(name);
    if (!regex) {
      return null;
    }
    return database.collection(collectionName).findOne({ name: regex });
  };

  const resolveRefsFromNames = async (database, { divisionName, departmentName, sectionName }) => {
    const department = await findByName(database, "departments", departmentName);
    const division = department?.divisionId
      ? await database.collection("divisions").findOne({ _id: department.divisionId })
      : await findByName(database, "divisions", divisionName);
    const section = sectionName && department?._id
      ? await database.collection("sections").findOne({
        name: orgNameRegex(sectionName),
        departmentId: department._id
      })
      : null;

    return { division, department, section };
  };

  const buildSnapshot = ({ division, department, section, matchedBy, confidence }) => {
    if (!department && !division && !section) {
      return null;
    }
    return {
      source: "jkspulse",
      division: toOrgRef(division),
      department: toOrgRef(department, true),
      section: toOrgRef(section),
      matchedBy,
      confidence
    };
  };

  const findPulseUser = async (database, { username, email }) => {
    const emailConditions = [];
    if (email) {
      emailConditions.push({ email: new RegExp(`^${escapeRegex(email)}$`, "i") });
    }
    if (username) {
      emailConditions.push(
        { email: new RegExp(`^${escapeRegex(username)}@`, "i") },
        { username: new RegExp(`^${escapeRegex(username)}$`, "i") }
      );
    }
    if (!emailConditions.length) {
      return null;
    }
    return database.collection("users").findOne({ $or: emailConditions });
  };

  const resolveForLdapUser = async ({ username, ldapAttributes = {} } = {}) => {
    const database = await getDb();
    if (!database) {
      return null;
    }

    const email = getLdapEmail(ldapAttributes);
    const pulseUser = await findPulseUser(database, { username, email });
    if (pulseUser) {
      const { division, department, section } = await resolveRefsFromNames(database, {
        divisionName: pulseUser.division,
        departmentName: pulseUser.department,
        sectionName: pulseUser.section
      });
      return buildSnapshot({
        division,
        department,
        section,
        matchedBy: email && pulseUser.email?.toLowerCase() === email.toLowerCase() ? "email" : "username",
        confidence: "exact"
      });
    }

    const ldapDepartment = getLdapDepartment(ldapAttributes);
    const department = await findByName(database, "departments", ldapDepartment);
    if (!department) {
      return null;
    }
    const division = department.divisionId
      ? await database.collection("divisions").findOne({ _id: department.divisionId })
      : null;

    return buildSnapshot({
      division,
      department,
      section: null,
      matchedBy: "department",
      confidence: department.name.trim().toLowerCase() === ldapDepartment.trim().toLowerCase() ? "exact" : "normalized"
    });
  };

  return {
    resolveForLdapUser,
    close: async () => {
      await client?.close?.();
      client = null;
      db = null;
    }
  };
};
