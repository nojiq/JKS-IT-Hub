import { ROLE_RANK } from "./roleAssignment.js";

const IT_DEPARTMENT_ALIASES = new Set([
  "it",
  "i t",
  "i.t",
  "it dept",
  "it department",
  "information technology",
  "information technologies"
]);

const normalizeDepartmentToken = (value) => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return "";
  }

  return trimmed
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const valuesFromDepartmentLike = (departmentLike) => {
  if (Array.isArray(departmentLike)) {
    return departmentLike.flatMap(valuesFromDepartmentLike);
  }

  if (!departmentLike || typeof departmentLike !== "object") {
    return [departmentLike];
  }

  return [
    departmentLike.code,
    departmentLike.name,
    departmentLike.department,
    departmentLike.dept,
    departmentLike.departmentName
  ];
};

const getAttributeValue = (attributes, keys) => {
  if (!attributes || typeof attributes !== "object") {
    return undefined;
  }

  const entries = Object.entries(attributes);
  for (const key of keys) {
    if (attributes[key] !== undefined) {
      return attributes[key];
    }

    const lowerKey = key.toLowerCase();
    const matchedEntry = entries.find(([entryKey]) => entryKey.toLowerCase() === lowerKey);
    if (matchedEntry) {
      return matchedEntry[1];
    }
  }

  return undefined;
};

export const isItDepartment = (departmentLike) =>
  valuesFromDepartmentLike(departmentLike)
    .map(normalizeDepartmentToken)
    .some((value) => IT_DEPARTMENT_ALIASES.has(value));

export const hasItDepartment = ({ ldapAttributes, orgSnapshot, department } = {}) => {
  const candidates = [
    department,
    orgSnapshot?.department,
    getAttributeValue(ldapAttributes, ["department"]),
    getAttributeValue(ldapAttributes, ["dept"]),
    getAttributeValue(ldapAttributes, ["departmentName"])
  ];

  return candidates.some(isItDepartment);
};

export const deriveRoleForDepartment = ({
  currentRole = "requester",
  role,
  ldapAttributes,
  orgSnapshot,
  department
} = {}) => {
  const baseRole = role ?? currentRole ?? "requester";

  if (!hasItDepartment({ ldapAttributes, orgSnapshot, department })) {
    return baseRole;
  }

  const baseRank = ROLE_RANK[baseRole];
  if (baseRank === undefined || baseRank > ROLE_RANK.requester) {
    return baseRole;
  }

  return "it";
};
