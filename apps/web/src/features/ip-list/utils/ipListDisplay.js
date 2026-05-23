import { formatDisplayDateTime } from "../../../shared/utils/date-format.js";
import { formatMacAddress } from "../../assets/utils/assetDisplay.js";

export const SOURCE_OPTIONS = [
  { value: "asset", label: "Asset" },
  { value: "manual", label: "Manual" }
];

export const SOURCE_LABELS = {
  asset: "Asset",
  manual: "Manual"
};

export const SOURCE_BADGE_CLASS = {
  asset: "is-asset",
  manual: "is-manual"
};

export const formatValue = (value, fallback = "—") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

export const formatDateTime = (value) =>
  formatDisplayDateTime(value, { fallback: "—", includeSeconds: true });

export const getSourceLabel = (source) => SOURCE_LABELS[source] ?? formatValue(source, "Unknown");

export const UNMAPPED_SUBNET_ID = "__unmapped__";

export const ipv4ToSlash24Prefix = (ipAddress) => {
  const parts = String(ipAddress ?? "").trim().split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => octet < 0 || octet > 255)) return null;
  return `${octets[0]}.${octets[1]}.${octets[2]}`;
};

export const slash24PrefixToRange = (prefix) => {
  const parts = String(prefix ?? "").split(".").map(Number);
  if (parts.length !== 3 || parts.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return null;
  }
  const [a, b, c] = parts;
  const start = (BigInt(a) << 24n) + (BigInt(b) << 16n) + (BigInt(c) << 8n);
  return { start, end: start + 255n };
};

export const ruleCoversSlash24Prefix = (rule, prefix) => {
  const range = slash24PrefixToRange(prefix);
  if (!range || rule?.rangeStart === undefined || rule?.rangeEnd === undefined) return false;
  const ruleStart = BigInt(rule.rangeStart);
  const ruleEnd = BigInt(rule.rangeEnd);
  return ruleStart <= range.start && range.end <= ruleEnd;
};

export const rowMatchesIpPrefix = (row, ipPrefix) => {
  if (!ipPrefix) return true;
  const ip = row?.ipAddress ?? "";
  return ip === ipPrefix || ip.startsWith(`${ipPrefix}.`);
};

export const formatSlash24Label = (prefix) => `${prefix}.x`;

export const buildSubnetFilterOptions = (rules = []) =>
  rules.map((rule) => ({
    value: rule.id,
    label: `${rule.purpose} · ${rule.cidr}`
  }));

export const getSubnetPurposeLabel = (subnet) => subnet?.purpose ?? "Unmapped";

/**
 * Grouped combobox options: All, subnet rules, detected /24 prefixes, Unmapped.
 * Counts respect search/source filters (rows/groups input), not active subnet filter.
 */
export const buildSubnetComboboxOptions = (rows = [], rules = [], groups = []) => {
  const countByRuleId = new Map();
  let unmappedCount = 0;

  for (const group of groups) {
    if (group.subnet?.id) {
      countByRuleId.set(group.subnet.id, group.count);
    } else {
      unmappedCount = group.count;
    }
  }

  const sortedRules = [...rules].sort((a, b) => {
    const aStart = BigInt(a.rangeStart ?? -1);
    const bStart = BigInt(b.rangeStart ?? -1);
    return aStart < bStart ? -1 : aStart > bStart ? 1 : a.purpose.localeCompare(b.purpose);
  });

  const ruleOptions = sortedRules.map((rule) => ({
    id: `rule:${rule.id}`,
    kind: "rule",
    value: rule.id,
    label: rule.purpose,
    sublabel: rule.cidr,
    count: countByRuleId.get(rule.id) ?? 0,
    section: "rules"
  }));

  const detectedCounts = new Map();
  for (const row of rows) {
    if (row.subnet) continue;
    const prefix = ipv4ToSlash24Prefix(row.ipAddress);
    if (!prefix) continue;
    if (sortedRules.some((rule) => ruleCoversSlash24Prefix(rule, prefix))) continue;
    detectedCounts.set(prefix, (detectedCounts.get(prefix) ?? 0) + 1);
  }

  const detectedOptions = [...detectedCounts.entries()]
    .sort(([a], [b]) => {
      const aKey = slash24PrefixToRange(a)?.start ?? 0n;
      const bKey = slash24PrefixToRange(b)?.start ?? 0n;
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
    })
    .map(([prefix, count]) => ({
      id: `prefix:${prefix}`,
      kind: "prefix",
      value: prefix,
      label: formatSlash24Label(prefix),
      sublabel: `${prefix}.0/24`,
      count,
      section: "detected"
    }));

  const otherOptions = [
    {
      id: "unmapped",
      kind: "unmapped",
      value: UNMAPPED_SUBNET_ID,
      label: "Unmapped",
      sublabel: "No matching subnet rule",
      count: unmappedCount,
      section: "other"
    }
  ];

  return {
    allOption: {
      id: "all",
      kind: "all",
      value: "",
      label: "All subnets",
      sublabel: null,
      count: rows.length,
      section: "other"
    },
    sections: [
      { id: "rules", label: "Subnet rules", options: ruleOptions },
      { id: "detected", label: "Detected networks", options: detectedOptions },
      { id: "other", label: "Other", options: otherOptions }
    ]
  };
};

export const filterComboboxOptions = (comboboxOptions, query = "") => {
  const normalized = String(query ?? "").trim().toLowerCase();
  if (!normalized) return comboboxOptions;

  const matches = (option) => {
    const haystack = [option.label, option.sublabel, option.value]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  };

  const allOption = matches(comboboxOptions.allOption) ? comboboxOptions.allOption : null;
  const sections = comboboxOptions.sections
    .map((section) => ({
      ...section,
      options: section.options.filter(matches)
    }))
    .filter((section) => section.options.length > 0);

  return { allOption, sections };
};

export const resolveSubnetFilterForRow = (row) => {
  if (!row?.subnet?.id) return UNMAPPED_SUBNET_ID;
  return row.subnet.id;
};

export const getRowHostname = (row) => {
  if (!row) return null;
  if (row.source === "asset") {
    return row.asset?.name || row.asset?.assetTag || row.hostname || null;
  }
  return row.manualRecord?.hostname || row.hostname || null;
};

export const getRowLocation = (row) => row?.manualRecord?.location ?? null;
export const getRowDepartment = (row) => row?.manualRecord?.department ?? null;

export const getRowWhere = (row) => {
  const parts = [getRowLocation(row), getRowDepartment(row)].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
};

export const getRowMac = (row) => {
  if (!row) return null;
  let raw = null;
  if (row.source === "manual") {
    raw = row.manualRecord?.macAddress ?? null;
  } else {
    raw =
      row.asset?.macAddressLan ||
      row.asset?.macAddressWifi5Ghz ||
      row.asset?.macAddressWifi24Ghz ||
      null;
  }
  if (!raw) return null;
  return formatMacAddress(raw) ?? raw;
};

export const formatHostNumber = (hostNumber) => {
  if (hostNumber === null || hostNumber === undefined || hostNumber === "") return "—";
  return `.${hostNumber}`;
};

export const isValidIpv4 = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return false;
  return new RegExp(ipAddressPattern).test(text);
};

export const getExistingIpLabel = (record) => {
  if (!record) return null;
  if (record.source === "asset") {
    return record.asset?.assetTag || record.asset?.name || record.ipAddress;
  }
  return record.manualRecord?.hostname || record.hostname || record.ipAddress;
};

export const getSubnetLabel = (subnet) => {
  if (!subnet) return "Unmapped";
  return `${subnet.purpose} · ${subnet.cidr}`;
};

export const ipAddressPattern = "^(25[0-5]|2[0-4]\\d|1?\\d?\\d)(\\.(25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}$";
