import test from "node:test";
import assert from "node:assert/strict";

import { createIpListService } from "../../apps/api/src/features/ip-list/service.js";
import { parseIpv4Cidr, parseIpv4Address } from "../../apps/api/src/features/ip-list/ipUtils.js";

const makeRepo = ({
  assets = [],
  manualRecords = [],
  subnetRules = []
} = {}) => {
  const state = {
    assets: assets.map((asset) => ({ ...asset })),
    manualRecords: manualRecords.map((record) => ({ ...record })),
    subnetRules: subnetRules.map((rule) => ({ ...rule }))
  };

  return {
    state,
    listAssetIpRecords: async () => state.assets,
    listManualIpRecords: async () => state.manualRecords,
    listSubnetRules: async () => state.subnetRules,
    findAssetByIpAddress: async (ipAddress) => state.assets.find((asset) => asset.ipAddress === ipAddress) ?? null,
    findManualByIpAddress: async (ipAddress) => state.manualRecords.find((record) => record.ipAddress === ipAddress) ?? null,
    findManualById: async (id) => state.manualRecords.find((record) => record.id === id) ?? null,
    createManualIpRecord: async (data) => {
      const record = {
        id: `manual-${state.manualRecords.length + 1}`,
        createdAt: new Date("2026-05-22T00:00:00.000Z"),
        updatedAt: new Date("2026-05-22T00:00:00.000Z"),
        ...data
      };
      state.manualRecords.push(record);
      return record;
    },
    updateManualIpRecord: async (id, data) => {
      const record = state.manualRecords.find((entry) => entry.id === id);
      Object.assign(record, data);
      return record;
    },
    deleteManualIpRecord: async (id) => {
      state.manualRecords = state.manualRecords.filter((record) => record.id !== id);
      return { id };
    },
    findSubnetByCidr: async (cidr) => state.subnetRules.find((rule) => rule.cidr === cidr) ?? null,
    findSubnetById: async (id) => state.subnetRules.find((rule) => rule.id === id) ?? null,
    createSubnetRule: async (data) => {
      const rule = {
        id: `subnet-${state.subnetRules.length + 1}`,
        createdAt: new Date("2026-05-22T00:00:00.000Z"),
        updatedAt: new Date("2026-05-22T00:00:00.000Z"),
        ...data
      };
      state.subnetRules.push(rule);
      return rule;
    },
    updateSubnetRule: async (id, data) => {
      const rule = state.subnetRules.find((entry) => entry.id === id);
      Object.assign(rule, data);
      return rule;
    },
    deleteSubnetRule: async (id) => {
      state.subnetRules = state.subnetRules.filter((rule) => rule.id !== id);
      return { id };
    }
  };
};

test("parseIpv4Cidr derives range fields for subnet matching", () => {
  const parsed = parseIpv4Cidr("192.168.78.0/24");

  assert.deepEqual(parsed, {
    cidr: "192.168.78.0/24",
    networkAddress: "192.168.78.0",
    prefixLength: 24,
    rangeStart: parseIpv4Address("192.168.78.0"),
    rangeEnd: parseIpv4Address("192.168.78.255")
  });
});

test("listInventory merges asset and manual records under matching subnet rules", async () => {
  const repo = makeRepo({
    assets: [{
      id: "asset-1",
      assetTag: "SRV001",
      name: "Backup Server",
      categoryName: "Server",
      ipAddress: "192.168.78.15",
      macAddressLan: "AA:BB:CC:DD:EE:01",
      lastSyncedAt: new Date("2026-05-22T00:00:00.000Z")
    }],
    manualRecords: [{
      id: "manual-1",
      ipAddress: "192.168.28.20",
      ipAddressInt: parseIpv4Address("192.168.28.20"),
      hostname: "Printer L1",
      location: "Level 1",
      department: "Admin",
      macAddress: "AA:BB:CC:DD:EE:20",
      notes: "Manual",
      createdAt: new Date("2026-05-22T00:00:00.000Z"),
      updatedAt: new Date("2026-05-22T00:00:00.000Z")
    }],
    subnetRules: [
      { id: "subnet-78", ...parseIpv4Cidr("192.168.78.0/24"), purpose: "Server", description: null },
      { id: "subnet-28", ...parseIpv4Cidr("192.168.28.0/24"), purpose: "Printer", description: null },
      { id: "subnet-8", ...parseIpv4Cidr("192.168.8.0/24"), purpose: "Empty", description: null }
    ]
  });
  const service = createIpListService({ repo });

  const result = await service.listInventory();

  assert.equal(result.data.length, 2);
  assert.deepEqual(result.groups.map((group) => group.purpose), ["Printer", "Server"]);
  assert.ok(!result.groups.some((group) => group.purpose === "Empty"));
  assert.equal(result.data.find((row) => row.ipAddress === "192.168.78.15").source, "asset");
  assert.equal(result.data.find((row) => row.ipAddress === "192.168.28.20").source, "manual");
});

test("createManualRecord rejects duplicate asset IP with redirect target", async () => {
  const repo = makeRepo({
    assets: [{ id: "asset-1", assetTag: "SRV001", ipAddress: "192.168.78.15" }]
  });
  const service = createIpListService({ repo });

  await assert.rejects(
    () => service.createManualRecord({ ipAddress: "192.168.78.15", hostname: "Duplicate" }, { id: "user-1" }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.existing.source, "asset");
      assert.equal(error.existing.id, "asset-1");
      assert.equal(error.redirectTo, "/ip-list/192.168.78.15");
      return true;
    }
  );
});

test("createManualRecord rejects duplicate manual IP but allows same host in another subnet", async () => {
  const repo = makeRepo({
    manualRecords: [{
      id: "manual-1",
      ipAddress: "192.168.78.15",
      ipAddressInt: parseIpv4Address("192.168.78.15"),
      hostname: "Existing"
    }]
  });
  const service = createIpListService({ repo });

  await assert.rejects(
    () => service.createManualRecord({ ipAddress: "192.168.78.15", hostname: "Duplicate" }, { id: "user-1" }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.existing.source, "manual");
      assert.equal(error.existing.id, "manual-1");
      return true;
    }
  );

  const created = await service.createManualRecord({ ipAddress: "192.168.28.15", hostname: "Same host other subnet" }, { id: "user-1" });

  assert.equal(created.ipAddress, "192.168.28.15");
  assert.equal(created.hostname, "Same host other subnet");
});
