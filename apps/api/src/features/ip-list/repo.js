import { prisma } from "../../shared/db/prisma.js";

const userSelect = {
  id: true,
  username: true
};

const subnetRuleSelect = {
  id: true,
  cidr: true,
  networkAddress: true,
  prefixLength: true,
  rangeStart: true,
  rangeEnd: true,
  purpose: true,
  description: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true,
  createdByUser: { select: userSelect },
  updatedByUser: { select: userSelect }
};

const manualIpSelect = {
  id: true,
  ipAddress: true,
  ipAddressInt: true,
  hostname: true,
  location: true,
  department: true,
  macAddress: true,
  notes: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true,
  createdByUser: { select: userSelect },
  updatedByUser: { select: userSelect }
};

const assetIpSelect = {
  id: true,
  assetTag: true,
  name: true,
  serial: true,
  modelName: true,
  categoryName: true,
  statusLabel: true,
  ipAddress: true,
  macAddressLan: true,
  macAddressWifi5Ghz: true,
  macAddressWifi24Ghz: true,
  snipeAssignedName: true,
  snipeAssignedUsername: true,
  snipeAssignedEmail: true,
  assignedToUserId: true,
  assignmentSource: true,
  lastSyncedAt: true,
  createdAt: true,
  updatedAt: true,
  assignedToUser: {
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      orgSnapshot: true
    }
  }
};

export const listAssetIpRecords = (tx = prisma) => tx.asset.findMany({
  where: {
    ipAddress: {
      not: null
    }
  },
  orderBy: [{ ipAddress: "asc" }],
  select: assetIpSelect
});

export const findAssetByIpAddress = (ipAddress, tx = prisma) => tx.asset.findFirst({
  where: { ipAddress },
  select: assetIpSelect
});

export const listManualIpRecords = (tx = prisma) => tx.manualIpRecord.findMany({
  orderBy: [{ ipAddressInt: "asc" }],
  select: manualIpSelect
});

export const findManualByIpAddress = (ipAddress, tx = prisma) => tx.manualIpRecord.findUnique({
  where: { ipAddress },
  select: manualIpSelect
});

export const findManualById = (id, tx = prisma) => tx.manualIpRecord.findUnique({
  where: { id },
  select: manualIpSelect
});

export const createManualIpRecord = (data, tx = prisma) => tx.manualIpRecord.create({
  data,
  select: manualIpSelect
});

export const updateManualIpRecord = (id, data, tx = prisma) => tx.manualIpRecord.update({
  where: { id },
  data,
  select: manualIpSelect
});

export const deleteManualIpRecord = (id, tx = prisma) => tx.manualIpRecord.delete({
  where: { id },
  select: { id: true, ipAddress: true }
});

export const listSubnetRules = (tx = prisma) => tx.ipSubnetRule.findMany({
  orderBy: [{ rangeStart: "asc" }, { prefixLength: "desc" }],
  select: subnetRuleSelect
});

export const findSubnetByCidr = (cidr, tx = prisma) => tx.ipSubnetRule.findUnique({
  where: { cidr },
  select: subnetRuleSelect
});

export const findSubnetById = (id, tx = prisma) => tx.ipSubnetRule.findUnique({
  where: { id },
  select: subnetRuleSelect
});

export const createSubnetRule = (data, tx = prisma) => tx.ipSubnetRule.create({
  data,
  select: subnetRuleSelect
});

export const updateSubnetRule = (id, data, tx = prisma) => tx.ipSubnetRule.update({
  where: { id },
  data,
  select: subnetRuleSelect
});

export const deleteSubnetRule = (id, tx = prisma) => tx.ipSubnetRule.delete({
  where: { id },
  select: { id: true, cidr: true }
});
