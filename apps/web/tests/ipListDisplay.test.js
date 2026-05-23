import { describe, expect, it } from "vitest";
import {
  buildSubnetComboboxOptions,
  filterComboboxOptions,
  normalizeIpAddressInput,
  normalizeMacAddressInput,
  normalizeManualTextInput,
  resolveSubnetFilterForRow,
  rowMatchesIpPrefix,
  ruleCoversSlash24Prefix,
  UNMAPPED_SUBNET_ID
} from "../src/features/ip-list/utils/ipListDisplay.js";

describe("ipListDisplay subnet combobox", () => {
  it("resolveSubnetFilterForRow maps missing subnet to unmapped id", () => {
    expect(resolveSubnetFilterForRow({ subnet: { id: "sub-a" } })).toBe("sub-a");
    expect(resolveSubnetFilterForRow({ subnet: null })).toBe(UNMAPPED_SUBNET_ID);
  });

  const rules = [
    {
      id: "sub-a",
      purpose: "Server",
      cidr: "192.168.78.0/24",
      rangeStart: "3232255488",
      rangeEnd: "3232255743"
    }
  ];

  const rows = [
    { ipAddress: "192.168.78.10", subnet: { id: "sub-a", purpose: "Server", cidr: "192.168.78.0/24" } },
    { ipAddress: "192.168.78.99", subnet: null },
    { ipAddress: "10.0.0.5", subnet: null }
  ];

  const groups = [
    { subnet: { id: "sub-a", purpose: "Server", cidr: "192.168.78.0/24" }, purpose: "Server", count: 1 },
    { subnet: null, purpose: "Unmapped", count: 2 }
  ];

  it("buildSubnetComboboxOptions includes rules, detected /24, and unmapped", () => {
    const options = buildSubnetComboboxOptions(rows, rules, groups);
    const ruleIds = options.sections.find((s) => s.id === "rules")?.options.map((o) => o.id) ?? [];
    const detected = options.sections.find((s) => s.id === "detected")?.options ?? [];
    const other = options.sections.find((s) => s.id === "other")?.options ?? [];

    expect(ruleIds).toEqual(["rule:sub-a"]);
    expect(detected).toHaveLength(1);
    expect(detected[0]).toMatchObject({ kind: "prefix", value: "10.0.0" });
    expect(other[0]).toMatchObject({ kind: "unmapped", count: 2 });
    expect(options.allOption).toMatchObject({ kind: "all", count: 3 });
  });

  it("detected section lists unmapped /24 not covered by rules", () => {
    const options = buildSubnetComboboxOptions(rows, [], groups);
    const detected = options.sections.find((s) => s.id === "detected")?.options ?? [];
    expect(detected.map((o) => o.value).sort()).toEqual(["10.0.0", "192.168.78"]);
  });

  it("filterComboboxOptions matches prefix fragments like 78", () => {
    const options = buildSubnetComboboxOptions(rows, [], groups);
    const filtered = filterComboboxOptions(options, "78");
    const detected = filtered.sections.find((s) => s.id === "detected")?.options ?? [];
    expect(detected).toHaveLength(1);
    expect(detected[0].value).toBe("192.168.78");
  });

  it("rowMatchesIpPrefix supports /24 and shorter prefixes", () => {
    const row = { ipAddress: "192.168.78.15" };
    expect(rowMatchesIpPrefix(row, "192.168.78")).toBe(true);
    expect(rowMatchesIpPrefix(row, "192.168")).toBe(true);
    expect(rowMatchesIpPrefix(row, "10.0.0")).toBe(false);
  });

  it("ruleCoversSlash24Prefix detects overlapping CIDR", () => {
    expect(ruleCoversSlash24Prefix(rules[0], "192.168.78")).toBe(true);
    expect(ruleCoversSlash24Prefix(rules[0], "10.0.0")).toBe(false);
  });
});

describe("ipListDisplay manual form normalization", () => {
  it("normalizes IPv4 pasted with spaces or padded octets", () => {
    expect(normalizeIpAddressInput(" 192 168 078 015 ")).toBe("192.168.78.15");
    expect(normalizeIpAddressInput("192.168.078.015")).toBe("192.168.78.15");
    expect(normalizeIpAddressInput("1921687815")).toBe("192.168.78.15");
  });

  it("keeps partial IPv4 entry editable while removing invalid characters", () => {
    expect(normalizeIpAddressInput("192.168.")).toBe("192.168.");
    expect(normalizeIpAddressInput("192..168")).toBe("192.168");
  });

  it("formats compact and separated MAC input with uppercase colon pairs", () => {
    expect(normalizeMacAddressInput("990009909090")).toBe("99:00:09:90:90:90");
    expect(normalizeMacAddressInput("aa-bb-cc-dd-ee-ff")).toBe("AA:BB:CC:DD:EE:FF");
    expect(normalizeMacAddressInput("99000990909")).toBe("99:00:09:90:90:9");
  });

  it("collapses whitespace in regular manual text fields", () => {
    expect(normalizeManualTextInput("  HQ    Level   3  ")).toBe("HQ Level 3");
  });
});
