export const normalizeOrgName = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/\s+/g, " ");

export const firstString = (value) => {
  if (Array.isArray(value)) {
    return value.find((item) => typeof item === "string" && item.trim()) ?? "";
  }
  return typeof value === "string" ? value : "";
};

export const getLdapEmail = (attrs = {}) =>
  firstString(attrs.mail) || firstString(attrs.email) || firstString(attrs.userPrincipalName);

export const getLdapDepartment = (attrs = {}) => firstString(attrs.department) || firstString(attrs.dept);
