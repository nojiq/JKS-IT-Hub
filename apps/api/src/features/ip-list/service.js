import {
  findMatchingSubnet,
  getHostNumber,
  normalizeIpv4Address,
  parseIpv4Address,
  parseIpv4Cidr
} from "./ipUtils.js";

const OPTIONAL_TEXT_FIELDS = ["hostname", "location", "department", "macAddress", "notes"];

export const createIpListService = ({ repo }) => {
  const listInventory = async (filters = {}) => {
    const [assets, manualRecords, subnetRules] = await Promise.all([
      repo.listAssetIpRecords(),
      repo.listManualIpRecords(),
      repo.listSubnetRules()
    ]);

    const rows = [
      ...assets.map((asset) => mapAssetRow(asset, subnetRules)),
      ...manualRecords.map((record) => mapManualRow(record, subnetRules))
    ]
      .filter((row) => matchesFilters(row, filters))
      .sort((a, b) => (a.ipAddressInt < b.ipAddressInt ? -1 : a.ipAddressInt > b.ipAddressInt ? 1 : 0));

    return {
      data: rows.map(serializeInventoryRow),
      groups: buildGroups(rows)
    };
  };

  const getIpDetail = async (ipAddress) => {
    const normalizedIp = normalizeIpv4Address(ipAddress);
    const [asset, manual, subnetRules] = await Promise.all([
      repo.findAssetByIpAddress(normalizedIp),
      repo.findManualByIpAddress(normalizedIp),
      repo.listSubnetRules()
    ]);
    const row = asset ? mapAssetRow(asset, subnetRules) : manual ? mapManualRow(manual, subnetRules) : null;
    if (!row) {
      throw notFoundError("IP address not found");
    }
    return serializeInventoryRow(row);
  };

  const createManualRecord = async (payload, actor = null) => {
    const data = prepareManualData(payload, actor, { isCreate: true });
    await assertIpAvailable(data.ipAddress);
    const created = await repo.createManualIpRecord(data);
    return serializeManualRecord(created);
  };

  const updateManualRecord = async (id, payload, actor = null) => {
    const existing = await repo.findManualById(id);
    if (!existing) throw notFoundError("Manual IP record not found");

    const data = prepareManualData(payload, actor, { isCreate: false });
    if (data.ipAddress && data.ipAddress !== existing.ipAddress) {
      await assertIpAvailable(data.ipAddress, { excludeManualId: id });
    }
    const updated = await repo.updateManualIpRecord(id, data);
    return serializeManualRecord(updated);
  };

  const deleteManualRecord = async (id) => {
    const existing = await repo.findManualById(id);
    if (!existing) throw notFoundError("Manual IP record not found");
    return repo.deleteManualIpRecord(id);
  };

  const listSubnetRules = async () => (await repo.listSubnetRules()).map(serializeSubnetRule);

  const createSubnetRule = async (payload, actor = null) => {
    const parsed = parseIpv4Cidr(payload.cidr);
    const existing = await repo.findSubnetByCidr(parsed.cidr);
    if (existing) throw duplicateSubnetError(existing);
    const created = await repo.createSubnetRule({
      ...parsed,
      purpose: payload.purpose.trim(),
      description: cleanOptional(payload.description),
      createdByUserId: actor?.id ?? null,
      updatedByUserId: actor?.id ?? null
    });
    return serializeSubnetRule(created);
  };

  const updateSubnetRule = async (id, payload, actor = null) => {
    const existing = await repo.findSubnetById(id);
    if (!existing) throw notFoundError("Subnet rule not found");

    const parsed = payload.cidr ? parseIpv4Cidr(payload.cidr) : {};
    if (parsed.cidr && parsed.cidr !== existing.cidr) {
      const duplicate = await repo.findSubnetByCidr(parsed.cidr);
      if (duplicate && duplicate.id !== id) throw duplicateSubnetError(duplicate);
    }

    const data = {
      ...parsed,
      updatedByUserId: actor?.id ?? null
    };
    if (payload.purpose !== undefined) data.purpose = payload.purpose.trim();
    if (payload.description !== undefined) data.description = cleanOptional(payload.description);

    return serializeSubnetRule(await repo.updateSubnetRule(id, data));
  };

  const deleteSubnetRule = async (id) => {
    const existing = await repo.findSubnetById(id);
    if (!existing) throw notFoundError("Subnet rule not found");
    return repo.deleteSubnetRule(id);
  };

  const assertIpAvailable = async (ipAddress, { excludeManualId = null } = {}) => {
    const [asset, manual] = await Promise.all([
      repo.findAssetByIpAddress(ipAddress),
      repo.findManualByIpAddress(ipAddress)
    ]);
    if (asset) throw duplicateIpError(mapExistingAsset(asset));
    if (manual && manual.id !== excludeManualId) throw duplicateIpError(mapExistingManual(manual));
  };

  return {
    listInventory,
    getIpDetail,
    createManualRecord,
    updateManualRecord,
    deleteManualRecord,
    listSubnetRules,
    createSubnetRule,
    updateSubnetRule,
    deleteSubnetRule
  };
};

const prepareManualData = (payload, actor, { isCreate }) => {
  const data = {};
  if (isCreate || payload.ipAddress !== undefined) {
    const ipAddress = normalizeIpv4Address(payload.ipAddress);
    data.ipAddress = ipAddress;
    data.ipAddressInt = parseIpv4Address(ipAddress);
  }
  for (const field of OPTIONAL_TEXT_FIELDS) {
    if (isCreate || payload[field] !== undefined) {
      data[field] = cleanOptional(payload[field]);
    }
  }
  if (isCreate) data.createdByUserId = actor?.id ?? null;
  data.updatedByUserId = actor?.id ?? null;
  return data;
};

const cleanOptional = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const mapAssetRow = (asset, subnetRules) => {
  const ipAddressInt = parseIpv4Address(asset.ipAddress);
  const subnetRule = findMatchingSubnet(ipAddressInt, subnetRules);
  return {
    id: asset.id,
    source: "asset",
    ipAddress: normalizeIpv4Address(asset.ipAddress),
    ipAddressInt,
    hostNumber: getHostNumber(asset.ipAddress),
    hostname: asset.name || asset.assetTag || null,
    asset,
    subnetRule
  };
};

const mapManualRow = (record, subnetRules) => {
  const ipAddressInt = BigInt(record.ipAddressInt ?? parseIpv4Address(record.ipAddress));
  const subnetRule = findMatchingSubnet(ipAddressInt, subnetRules);
  return {
    id: record.id,
    source: "manual",
    ipAddress: normalizeIpv4Address(record.ipAddress),
    ipAddressInt,
    hostNumber: getHostNumber(record.ipAddress),
    hostname: record.hostname ?? null,
    manualRecord: record,
    subnetRule
  };
};

const serializeInventoryRow = (row) => ({
  id: row.id,
  source: row.source,
  ipAddress: row.ipAddress,
  hostNumber: row.hostNumber,
  hostname: row.hostname,
  subnet: row.subnetRule ? serializeSubnetRule(row.subnetRule) : null,
  asset: row.asset ? {
    id: row.asset.id,
    assetTag: row.asset.assetTag,
    name: row.asset.name,
    serial: row.asset.serial,
    modelName: row.asset.modelName,
    categoryName: row.asset.categoryName,
    statusLabel: row.asset.statusLabel,
    macAddressLan: row.asset.macAddressLan,
    macAddressWifi5Ghz: row.asset.macAddressWifi5Ghz,
    macAddressWifi24Ghz: row.asset.macAddressWifi24Ghz,
    assignedToUser: row.asset.assignedToUser ?? null,
    snipeAssignedName: row.asset.snipeAssignedName,
    snipeAssignedUsername: row.asset.snipeAssignedUsername,
    snipeAssignedEmail: row.asset.snipeAssignedEmail,
    lastSyncedAt: row.asset.lastSyncedAt
  } : null,
  manualRecord: row.manualRecord ? serializeManualRecord(row.manualRecord) : null,
  redirectTo: `/ip-list/${row.ipAddress}`
});

const serializeManualRecord = (record) => ({
  id: record.id,
  source: "manual",
  ipAddress: record.ipAddress,
  hostname: record.hostname ?? null,
  location: record.location ?? null,
  department: record.department ?? null,
  macAddress: record.macAddress ?? null,
  notes: record.notes ?? null,
  createdByUserId: record.createdByUserId ?? null,
  updatedByUserId: record.updatedByUserId ?? null,
  createdByUser: record.createdByUser ?? null,
  updatedByUser: record.updatedByUser ?? null,
  createdAt: record.createdAt ?? null,
  updatedAt: record.updatedAt ?? null
});

const serializeSubnetRule = (rule) => ({
  id: rule.id,
  cidr: rule.cidr,
  networkAddress: rule.networkAddress,
  prefixLength: rule.prefixLength,
  rangeStart: rule.rangeStart?.toString?.() ?? String(rule.rangeStart),
  rangeEnd: rule.rangeEnd?.toString?.() ?? String(rule.rangeEnd),
  purpose: rule.purpose,
  description: rule.description ?? null,
  createdByUserId: rule.createdByUserId ?? null,
  updatedByUserId: rule.updatedByUserId ?? null,
  createdByUser: rule.createdByUser ?? null,
  updatedByUser: rule.updatedByUser ?? null,
  createdAt: rule.createdAt ?? null,
  updatedAt: rule.updatedAt ?? null
});

const buildGroups = (rows) => {
  const groups = new Map();
  for (const row of rows) {
    const key = row.subnetRule?.id ?? "unmapped";
    if (!groups.has(key)) {
      groups.set(key, {
        subnet: row.subnetRule ? serializeSubnetRule(row.subnetRule) : null,
        purpose: row.subnetRule?.purpose ?? "Unmapped",
        count: 0
      });
    }
    groups.get(key).count += 1;
  }
  return [...groups.values()].sort((a, b) => {
    const aStart = BigInt(a.subnet?.rangeStart ?? -1);
    const bStart = BigInt(b.subnet?.rangeStart ?? -1);
    return aStart < bStart ? -1 : aStart > bStart ? 1 : a.purpose.localeCompare(b.purpose);
  });
};

const matchesFilters = (row, filters = {}) => {
  if (filters.source && row.source !== filters.source) return false;
  if (filters.subnetId && row.subnetRule?.id !== filters.subnetId) return false;
  if (!filters.search) return true;
  const haystack = [
    row.ipAddress,
    row.hostname,
    row.subnetRule?.purpose,
    row.asset?.assetTag,
    row.asset?.serial,
    row.asset?.categoryName,
    row.manualRecord?.location,
    row.manualRecord?.department,
    row.manualRecord?.macAddress
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(String(filters.search).toLowerCase());
};

const mapExistingAsset = (asset) => ({
  source: "asset",
  id: asset.id,
  ipAddress: asset.ipAddress,
  label: asset.assetTag || asset.name || asset.ipAddress
});

const mapExistingManual = (record) => ({
  source: "manual",
  id: record.id,
  ipAddress: record.ipAddress,
  label: record.hostname || record.ipAddress
});

const duplicateIpError = (existing) => {
  const error = new Error("IP address already exists");
  error.statusCode = 409;
  error.type = "/problems/ip-list/duplicate-ip";
  error.existing = existing;
  error.redirectTo = `/ip-list/${existing.ipAddress}`;
  return error;
};

const duplicateSubnetError = (existing) => {
  const error = new Error("Subnet rule already exists");
  error.statusCode = 409;
  error.type = "/problems/ip-list/duplicate-subnet";
  error.existing = serializeSubnetRule(existing);
  return error;
};

const notFoundError = (message) => {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
};
