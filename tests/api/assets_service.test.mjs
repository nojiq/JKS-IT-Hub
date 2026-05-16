import test from "node:test";
import assert from "node:assert/strict";

import { normalizeSnipeAsset } from "../../apps/api/src/features/assets/normalizer.js";
import { createAssetService } from "../../apps/api/src/features/assets/service.js";

const makeRepo = ({ users = [], existingAssets = [] } = {}) => {
  const assetsBySnipeId = new Map(existingAssets.map((asset) => [asset.snipeAssetId, { ...asset }]));
  const usersById = new Map(users.map((user) => [user.id, user]));
  const syncRuns = [];

  const repoObject = {
    assetsBySnipeId,
    upserted: [],
    findAssetBySnipeAssetId: async (snipeAssetId) => assetsBySnipeId.get(snipeAssetId) ?? null,
    upsertAsset: async (data) => {
      const stored = {
        id: assetsBySnipeId.get(data.snipeAssetId)?.id ?? `asset-${data.snipeAssetId}`,
        ...data
      };
      assetsBySnipeId.set(data.snipeAssetId, stored);
      repoObject.upserted.push(stored);
      return stored;
    },
    findUserByUsernameInsensitive: async (username) => {
      if (!username) return null;
      return users.find((user) => user.username.toLowerCase() === username.toLowerCase()) ?? null;
    },
    findUserByEmailInsensitive: async (email) => {
      if (!email) return null;
      const lower = email.toLowerCase();
      return users.find((user) => {
        const attrs = user.ldapAttributes ?? {};
        return [attrs.mail, attrs.userPrincipalName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase() === lower);
      }) ?? null;
    },
    createSyncRun: async () => {
      const run = { id: `run-${syncRuns.length + 1}`, status: "started" };
      syncRuns.push(run);
      return run;
    },
    completeSyncRun: async (id, summary) => ({ id, status: "completed", ...summary }),
    failSyncRun: async (id, error) => ({ id, status: "failed", errorMessage: error.message }),
    listAssets: async () => ({ data: [...assetsBySnipeId.values()], total: assetsBySnipeId.size, page: 1, perPage: 20 }),
    findAssetById: async (id) => [...assetsBySnipeId.values()].find((asset) => asset.id === id) ?? null,
    setManualLink: async (assetId, userId) => {
      const asset = [...assetsBySnipeId.values()].find((entry) => entry.id === assetId);
      Object.assign(asset, { assignedToUserId: userId, assignmentSource: "manual" });
      return asset;
    },
    clearLink: async (assetId, assignment) => {
      const asset = [...assetsBySnipeId.values()].find((entry) => entry.id === assetId);
      Object.assign(asset, assignment);
      return asset;
    },
    getLatestSyncRun: async () => syncRuns.at(-1) ?? null,
    findUserById: async (id) => usersById.get(id) ?? null
  };
  return repoObject;
};

test("normalizeSnipeAsset maps assigned user snapshot fields", () => {
  const syncedAt = new Date("2026-05-16T00:00:00Z");
  const asset = normalizeSnipeAsset({
    id: 123,
    asset_tag: "LAP123",
    name: "Laptop",
    serial: "ABC",
    model: { name: "Latitude 5420" },
    category: { name: "Laptop" },
    status_label: { name: "Ready to Deploy" },
    assigned_to: {
      id: 456,
      type: "user",
      name: "Jane Smith",
      username: "jane.smith",
      email: "jane@example.com"
    }
  }, syncedAt);

  assert.equal(asset.snipeAssetId, 123);
  assert.equal(asset.assetTag, "LAP123");
  assert.equal(asset.modelName, "Latitude 5420");
  assert.equal(asset.snipeAssignedUsername, "jane.smith");
  assert.equal(asset.assignmentFingerprint, "user|456|jane.smith|jane@example.com|jane smith");
  assert.equal(asset.lastSyncedAt, syncedAt);
});

test("asset sync matches username before email and records summary", async () => {
  const repo = makeRepo({
    users: [
      { id: "user-1", username: "jane.smith", ldapAttributes: { mail: "wrong@example.com" } },
      { id: "user-2", username: "email.owner", ldapAttributes: { mail: "jane@example.com" } }
    ]
  });
  const client = {
    isConfigured: () => true,
    fetchAllHardware: async () => [
      {
        id: 1,
        asset_tag: "LAP001",
        assigned_to: { id: 10, type: "user", username: "JANE.SMITH", email: "jane@example.com" }
      }
    ]
  };

  const service = createAssetService({ repo, client, userRepo: repo });
  const summary = await service.syncAssets();

  assert.deepEqual(summary, { fetchedCount: 1, upsertedCount: 1, matchedCount: 1, unmatchedCount: 0 });
  assert.equal(repo.upserted[0].assignedToUserId, "user-1");
  assert.equal(repo.upserted[0].assignmentSource, "auto_username");
});

test("asset sync falls back to LDAP email match", async () => {
  const repo = makeRepo({
    users: [
      { id: "user-1", username: "email.owner", ldapAttributes: { userPrincipalName: "owner@example.com" } }
    ]
  });
  const client = {
    isConfigured: () => true,
    fetchAllHardware: async () => [
      {
        id: 2,
        asset_tag: "LAP002",
        assigned_to: { id: 20, type: "user", username: "external.owner", email: "OWNER@example.com" }
      }
    ]
  };

  const service = createAssetService({ repo, client, userRepo: repo });
  await service.syncAssets();

  assert.equal(repo.upserted[0].assignedToUserId, "user-1");
  assert.equal(repo.upserted[0].assignmentSource, "auto_email");
});

test("asset sync preserves manual link when Snipe assignment unchanged", async () => {
  const existing = normalizeSnipeAsset({
    id: 3,
    asset_tag: "LAP003",
    assigned_to: { id: 30, type: "user", username: "unknown", email: "unknown@example.com" }
  });
  const repo = makeRepo({
    users: [{ id: "manual-user", username: "manual.user", ldapAttributes: {} }],
    existingAssets: [{
      id: "asset-3",
      ...existing,
      assignedToUserId: "manual-user",
      assignmentSource: "manual"
    }]
  });
  const client = {
    isConfigured: () => true,
    fetchAllHardware: async () => [
      {
        id: 3,
        asset_tag: "LAP003",
        assigned_to: { id: 30, type: "user", username: "unknown", email: "unknown@example.com" }
      }
    ]
  };

  const service = createAssetService({ repo, client, userRepo: repo });
  await service.syncAssets();

  assert.equal(repo.upserted[0].assignedToUserId, "manual-user");
  assert.equal(repo.upserted[0].assignmentSource, "manual");
});

test("asset sync clears stale manual link when Snipe assignment changes", async () => {
  const existing = normalizeSnipeAsset({
    id: 4,
    asset_tag: "LAP004",
    assigned_to: { id: 40, type: "user", username: "old", email: "old@example.com" }
  });
  const repo = makeRepo({
    users: [{ id: "new-user", username: "new.owner", ldapAttributes: {} }],
    existingAssets: [{
      id: "asset-4",
      ...existing,
      assignedToUserId: "manual-user",
      assignmentSource: "manual"
    }]
  });
  const client = {
    isConfigured: () => true,
    fetchAllHardware: async () => [
      {
        id: 4,
        asset_tag: "LAP004",
        assigned_to: { id: 41, type: "user", username: "new.owner", email: "new@example.com" }
      }
    ]
  };

  const service = createAssetService({ repo, client, userRepo: repo });
  await service.syncAssets();

  assert.equal(repo.upserted[0].assignedToUserId, "new-user");
  assert.equal(repo.upserted[0].assignmentSource, "auto_username");
});

test("asset sync marks unassigned and non-user assignments", async () => {
  const repo = makeRepo();
  const client = {
    isConfigured: () => true,
    fetchAllHardware: async () => [
      { id: 5, asset_tag: "LAP005", assigned_to: null },
      { id: 6, asset_tag: "LAP006", assigned_to: { id: 50, type: "location", name: "Store" } }
    ]
  };

  const service = createAssetService({ repo, client, userRepo: repo });
  await service.syncAssets();

  assert.equal(repo.upserted[0].assignmentSource, "unassigned");
  assert.equal(repo.upserted[1].assignmentSource, "non_user");
});
