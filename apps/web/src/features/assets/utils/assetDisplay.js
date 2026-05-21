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

const SEPARATED_MAC_PATTERN =
  /(^|[^0-9a-f])([0-9a-f]{2})([:-])([0-9a-f]{2})\3([0-9a-f]{2})\3([0-9a-f]{2})\3([0-9a-f]{2})\3([0-9a-f]{2})(?=$|[^0-9a-f])/i;
const COMPACT_MAC_PATTERN = /(^|[^0-9a-f])([0-9a-f]{12})(?=$|[^0-9a-f])/i;

export const formatMacAddress = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const separatedMatch = text.match(SEPARATED_MAC_PATTERN);
  if (separatedMatch) {
    return [
      separatedMatch[2],
      separatedMatch[4],
      separatedMatch[5],
      separatedMatch[6],
      separatedMatch[7],
      separatedMatch[8]
    ].map((part) => part.toUpperCase()).join(":");
  }

  const compactMatch = text.match(COMPACT_MAC_PATTERN);
  if (!compactMatch) {
    return null;
  }

  return compactMatch[2]
    .match(/.{2}/g)
    .map((part) => part.toUpperCase())
    .join(":");
};

export const getAssetMacAddressRows = (asset) => [
  ["LAN", formatMacAddress(asset?.macAddressLan)],
  ["Wi-Fi 5GHz", formatMacAddress(asset?.macAddressWifi5Ghz)],
  ["Wi-Fi 2.4GHz", formatMacAddress(asset?.macAddressWifi24Ghz)]
].filter(([, value]) => Boolean(value));

export const buildStatusFilterOptions = (statuses = []) =>
  statuses.map((status) => ({ value: status, label: status }));

export const buildCategoryFilterOptions = (categories = []) =>
  categories.map((category) => ({ value: category, label: category }));

const STATUS_TONE_RULES = [
  { tone: "ready", patterns: [/ready/i, /available/i, /stock/i] },
  { tone: "deployed", patterns: [/deploy/i, /assigned/i, /in use/i, /active/i] },
  { tone: "repair", patterns: [/repair/i, /maintenance/i, /warranty/i] },
  { tone: "retired", patterns: [/retired/i, /disposed/i, /archived/i, /lost/i, /stolen/i] },
  { tone: "pending", patterns: [/pending/i, /await/i, /request/i] }
];

export const getAssetStatusTone = (statusLabel) => {
  const label = String(statusLabel ?? "").trim();
  if (!label) {
    return "neutral";
  }

  const matched = STATUS_TONE_RULES.find((rule) =>
    rule.patterns.some((pattern) => pattern.test(label))
  );

  return matched?.tone ?? "neutral";
};
