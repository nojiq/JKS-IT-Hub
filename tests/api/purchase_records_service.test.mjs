import test from "node:test";
import assert from "node:assert/strict";

import { createPurchaseRecordsService } from "../../apps/api/src/features/purchase-records/service.js";
import { createProductImageCache } from "../../apps/api/src/features/purchase-records/productImageCache.js";

test("purchase record service creates multi-item record and audits creation", async () => {
  const auditLogs = [];
  const repo = {
    createPurchaseRecord: async (data) => ({
      id: "record-1",
      requesterId: data.requesterId,
      reason: data.reason,
      recordStatus: "RECORDED",
      approvalStatus: "NOT_REQUIRED",
      items: data.items.create.map((item, index) => ({ id: `item-${index + 1}`, ...item }))
    })
  };
  const service = createPurchaseRecordsService({
    repo,
    auditRepo: { createAuditLog: async (entry) => auditLogs.push(entry) },
    snipeClient: {}
  });

  const record = await service.createPurchaseRecord({
    reason: "New staff onboarding",
    items: [
      { itemName: "Laptop", quantity: 2, category: "Hardware" },
      { itemName: "Mouse", quantity: 5, category: "Accessory" }
    ]
  }, { id: "user-1", username: "requester", status: "active" });

  assert.equal(record.items.length, 2);
  assert.equal(record.items[0].quantity, 2);
  assert.equal(record.approvalStatus, "NOT_REQUIRED");
  assert.equal(auditLogs[0].action, "purchase_record_created");
});

test("purchase record service stores marketplace source fields and cached image URL", async () => {
  const cachedImages = [];
  const repo = {
    createPurchaseRecord: async (data) => ({
      id: "record-marketplace",
      requesterId: data.requesterId,
      reason: data.reason,
      items: data.items.create.map((item, index) => ({ id: `item-${index + 1}`, ...item }))
    })
  };
  const service = createPurchaseRecordsService({
    repo,
    auditRepo: { createAuditLog: async () => {} },
    snipeClient: {},
    imageCache: {
      cacheRemoteProductImage: async (url) => {
        cachedImages.push(url);
        return "/api/v1/uploads/product-image.webp";
      }
    }
  });

  const record = await service.createPurchaseRecord({
    reason: "Buy mouse",
    items: [{
      itemName: "Logitech Mouse",
      quantity: 2,
      category: "Mouse",
      unitCost: "59.90",
      marketplaceSource: {
        marketplace: "SHOPEE",
        sourceUrl: "https://shopee.com.my/product/1/2",
        imageUrl: "https://down-my.img.susercontent.com/file/mouse.webp",
        snapshot: {
          categoryPath: ["Computer Accessories", "Mouse"],
          variant: { label: "Black" }
        }
      }
    }]
  }, { id: "user-1", username: "requester", status: "active" });

  assert.deepEqual(cachedImages, ["https://down-my.img.susercontent.com/file/mouse.webp"]);
  assert.equal(record.items[0].unitCost, "59.90");
  assert.equal(record.items[0].lineTotal, "119.80");
  assert.equal(record.items[0].imageFileUrl, "/api/v1/uploads/product-image.webp");
  assert.equal(record.items[0].sourceMarketplace, "SHOPEE");
  assert.equal(record.items[0].sourceUrl, "https://shopee.com.my/product/1/2");
  assert.equal(record.items[0].sourceImageUrl, "https://down-my.img.susercontent.com/file/mouse.webp");
  assert.equal(record.items[0].sourceSnapshot.categoryPath[1], "Mouse");
});

test("purchase record service stores verified Snipe snapshot", async () => {
  const updates = [];
  const repo = {
    getPurchaseRecordById: async () => ({
      id: "record-1",
      requesterId: "requester-1",
      items: [{ id: "item-1" }]
    }),
    updatePurchaseRecordItemSnipeVerification: async (itemId, data) => {
      updates.push({ itemId, data });
      return { id: itemId, ...data };
    }
  };
  const service = createPurchaseRecordsService({
    repo,
    auditRepo: { createAuditLog: async () => {} },
    snipeClient: {
      fetchSnipeEntity: async (type, id) => ({
        id,
        name: "Latitude 7440",
        asset_tag: "LAP-001",
        category: { name: "Laptop" },
        type
      })
    }
  });

  const result = await service.verifyPurchaseRecordItemInSnipe(
    "record-1",
    "item-1",
    { snipeType: "HARDWARE", snipeId: 123 },
    { id: "it-1", role: "it" }
  );

  assert.equal(result.snipeVerificationStatus, "VERIFIED");
  assert.equal(result.snipeDisplayName, "Latitude 7440");
  assert.equal(updates[0].data.snipeId, 123);
  assert.ok(updates[0].data.snipeVerifiedAt instanceof Date);
});

test("purchase record service stores NOT_FOUND when Snipe entity is missing", async () => {
  const repo = {
    getPurchaseRecordById: async () => ({
      id: "record-1",
      requesterId: "requester-1",
      items: [{ id: "item-1" }]
    }),
    updatePurchaseRecordItemSnipeVerification: async (itemId, data) => ({ id: itemId, ...data })
  };
  const service = createPurchaseRecordsService({
    repo,
    auditRepo: { createAuditLog: async () => {} },
    snipeClient: { fetchSnipeEntity: async () => null }
  });

  const result = await service.verifyPurchaseRecordItemInSnipe(
    "record-1",
    "item-1",
    { snipeType: "LICENSE", snipeId: 404 },
    { id: "dev-1", role: "dev" }
  );

  assert.equal(result.snipeVerificationStatus, "NOT_FOUND");
  assert.equal(result.snipeDisplayName, null);
});

test("product image cache rejects non-image content types", async () => {
  const cache = createProductImageCache({
    fetchImpl: async () => new Response("not image", {
      status: 200,
      headers: { "content-type": "text/html" }
    })
  });

  await assert.rejects(
    () => cache.cacheRemoteProductImage("https://down-my.img.susercontent.com/file/not-image"),
    /Product image type is not supported/
  );
});
