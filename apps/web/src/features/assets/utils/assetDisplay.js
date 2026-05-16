import { formatDisplayDateTime } from "../../../shared/utils/date-format.js";

export const ASSIGNMENT_SOURCE_OPTIONS = [
  { value: "auto_matched", label: "Auto matched" },
  { value: "manual", label: "Manual" },
  { value: "unmatched", label: "Unmatched" },
  { value: "unassigned", label: "Unassigned" },
  { value: "non_user", label: "Non-user assignee" }
];

export const ASSIGNMENT_SOURCE_LABELS = {
  auto_username: "Auto (username)",
  auto_email: "Auto (email)",
  auto_matched: "Auto matched",
  manual: "Manual",
  unmatched: "Unmatched",
  unassigned: "Unassigned",
  non_user: "Non-user"
};

export const ASSIGNMENT_SOURCE_BADGE_CLASS = {
  auto_username: "is-auto",
  auto_email: "is-auto",
  auto_matched: "is-auto",
  manual: "is-manual",
  unmatched: "is-unmatched",
  unassigned: "is-muted",
  non_user: "is-non-user"
};

export const formatAssetValue = (value, fallback = "—") => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
};

export const formatAssetDateTime = (value) =>
  formatDisplayDateTime(value, { fallback: "—", includeSeconds: true });

export const getAssetModelLabel = (asset) =>
  formatAssetValue(asset?.modelName || asset?.name, "—");

export const getAssignmentSourceLabel = (source) =>
  ASSIGNMENT_SOURCE_LABELS[source] ?? formatAssetValue(source, "Unknown");

export const getLinkedUserLabel = (asset) => {
  const user = asset?.assignedToUser;
  if (!user?.username) {
    return null;
  }

  const ldap = user.ldapAttributes ?? user.ldapFields ?? {};
  const displayName =
    ldap.displayName ??
    ldap.cn ??
    ldap.name ??
    null;

  return displayName ? `${displayName} (${user.username})` : user.username;
};

export const getSnipeAssigneeSummary = (asset) => {
  const parts = [
    asset?.snipeAssignedName,
    asset?.snipeAssignedUsername ? `@${asset.snipeAssignedUsername}` : null,
    asset?.snipeAssignedEmail
  ].filter(Boolean);

  if (!parts.length) {
    return "No Snipe assignee on record";
  }

  return parts.join(" · ");
};

export const buildStatusFilterOptions = (statuses = []) =>
  statuses.map((status) => ({ value: status, label: status }));

export const buildCategoryFilterOptions = (categories = []) =>
  categories.map((category) => ({ value: category, label: category }));
