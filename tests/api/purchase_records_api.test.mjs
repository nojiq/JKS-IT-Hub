/* eslint-disable */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");

import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";
import { getAuthConfig } from "../../apps/api/src/config/authConfig.js";
import appPlugin from "../../apps/api/src/server.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";
import { uploadsConfig } from "../../apps/api/src/config/uploads.js";

const buildMultipartBody = ({ fields = {}, file }) => {
  const boundary = `----it-hub-boundary-${randomUUID()}`;
  const chunks = [];

  for (const [key, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
      `${value}\r\n`
    ));
  }

  if (file) {
    chunks.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="invoice"; filename="${file.filename}"\r\n` +
      `Content-Type: ${file.mimetype}\r\n\r\n`
    ));
    chunks.push(file.buffer);
    chunks.push(Buffer.from("\r\n"));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { boundary, payload: Buffer.concat(chunks) };
};

async function build(options = {}) {
  const app = Fastify();
  await app.register(appPlugin, {
    snipeClient: {
      isConfigured: () => true,
      fetchAllHardware: async () => [],
      fetchSnipeEntity: async (type, id) => ({ id, name: `${type}-${id}` })
    },
    ...options
  });
  return app;
}

test("Purchase Records API", async (t) => {
  const config = getAuthConfig();
  const app = await build();
  t.after(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const requester = await prisma.user.create({
    data: { username: `purchase-requester-${randomUUID()}`, role: "user", status: "active" }
  });
  const otherRequester = await prisma.user.create({
    data: { username: `purchase-other-${randomUUID()}`, role: "user", status: "active" }
  });
  const itUser = await prisma.user.create({
    data: { username: `purchase-it-${randomUUID()}`, role: "it", status: "active" }
  });

  const requesterToken = await signSessionToken({
    subject: requester.id,
    payload: { username: requester.username, role: requester.role, status: requester.status }
  }, config.jwt);
  const otherToken = await signSessionToken({
    subject: otherRequester.id,
    payload: { username: otherRequester.username, role: otherRequester.role, status: otherRequester.status }
  }, config.jwt);
  const itToken = await signSessionToken({
    subject: itUser.id,
    payload: { username: itUser.username, role: itUser.role, status: itUser.status }
  }, config.jwt);

  let recordId;
  let itemId;

  await t.test("POST /api/v1/purchase-records creates multi-item record without invoice", async () => {
    const multipart = buildMultipartBody({
      fields: {
        reason: "New branch office setup",
        vendorName: "JKS Supplier",
        itemsJson: JSON.stringify([
          { itemName: "Laptop", quantity: 2, category: "Hardware", snipeType: "HARDWARE" },
          { itemName: "Wireless Mouse", quantity: 5, category: "Accessory", unitCost: 30 }
        ])
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/purchase-records",
      headers: {
        cookie: `it-hub-session=${requesterToken}`,
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`
      },
      payload: multipart.payload
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.data.reason, "New branch office setup");
    assert.equal(body.data.recordStatus, "RECORDED");
    assert.equal(body.data.approvalStatus, "NOT_REQUIRED");
    assert.equal(body.data.items.length, 2);
    const laptop = body.data.items.find((item) => item.itemName === "Laptop");
    assert.equal(laptop.quantity, 2);
    recordId = body.data.id;
    itemId = laptop.id;
  });

  await t.test("GET detail returns items and blocks other requester", async () => {
    const okResponse = await app.inject({
      method: "GET",
      url: `/api/v1/purchase-records/${recordId}`,
      headers: { cookie: `it-hub-session=${requesterToken}` }
    });
    assert.equal(okResponse.statusCode, 200);
    assert.equal(JSON.parse(okResponse.body).data.items.length, 2);

    const deniedResponse = await app.inject({
      method: "GET",
      url: `/api/v1/purchase-records/${recordId}`,
      headers: { cookie: `it-hub-session=${otherToken}` }
    });
    assert.equal(deniedResponse.statusCode, 403);
  });

  await t.test("POST verify-snipe allows IT and blocks requester", async () => {
    const deniedResponse = await app.inject({
      method: "POST",
      url: `/api/v1/purchase-records/${recordId}/items/${itemId}/verify-snipe`,
      headers: { cookie: `it-hub-session=${requesterToken}` },
      payload: { snipeType: "HARDWARE", snipeId: 123 }
    });
    assert.equal(deniedResponse.statusCode, 403);

    const okResponse = await app.inject({
      method: "POST",
      url: `/api/v1/purchase-records/${recordId}/items/${itemId}/verify-snipe`,
      headers: { cookie: `it-hub-session=${itToken}` },
      payload: { snipeType: "HARDWARE", snipeId: 123 }
    });
    assert.equal(okResponse.statusCode, 200);
    assert.equal(JSON.parse(okResponse.body).data.snipeVerificationStatus, "VERIFIED");
  });
});

test("Purchase Records marketplace preview API", async (t) => {
  const config = getAuthConfig();
  const previews = [];
  const app = await build({
    marketplacePreviewService: {
      preview: async (url, actor) => {
        previews.push({ url, actorId: actor.id });
        return {
          marketplace: "SHOPEE",
          name: "Logitech Mouse",
          vendorName: "Logitech Official Store",
          imageUrl: "https://down-my.img.susercontent.com/file/mouse.webp",
          categoryPath: ["Computer Accessories", "Mouse"],
          currency: "MYR",
          variants: [{
            label: "Black",
            options: { Color: "Black" },
            price: "59.90",
            currency: "MYR",
            imageUrl: "https://down-my.img.susercontent.com/file/mouse.webp",
            available: true
          }],
          sourceUrl: "https://shopee.com.my/product/1/2",
          fetchedAt: "2026-05-21T00:00:00.000Z",
          confidence: "high"
        };
      }
    }
  });
  t.after(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const requester = await prisma.user.create({
    data: { username: `preview-requester-${randomUUID()}`, role: "user", status: "active" }
  });
  const token = await signSessionToken({
    subject: requester.id,
    payload: { username: requester.username, role: requester.role, status: requester.status }
  }, config.jwt);

  await t.test("returns normalized preview for supported marketplace URL", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/purchase-records/marketplace-preview",
      headers: { cookie: `it-hub-session=${token}` },
      payload: { url: "https://shopee.com.my/product/1/2" }
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.data.marketplace, "SHOPEE");
    assert.equal(body.data.variants[0].price, "59.90");
    assert.equal(previews[0].actorId, requester.id);
  });

  await t.test("rejects unsupported marketplace URL before calling scraper", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/purchase-records/marketplace-preview",
      headers: { cookie: `it-hub-session=${token}` },
      payload: { url: "https://example.com/item" }
    });

    assert.equal(response.statusCode, 400);
    assert.equal(previews.length, 1);
  });
});

test("Purchase record product image upload access follows record permissions", async (t) => {
  const config = getAuthConfig();
  const imageFileName = `product-access-${randomUUID()}.webp`;
  const createdUserIds = [];
  let createdRecordId = null;
  await fs.mkdir(uploadsConfig.uploadDir, { recursive: true });
  await fs.writeFile(`${uploadsConfig.uploadDir}/${imageFileName}`, Buffer.from("RIFFxxxxWEBP"));

  const app = await build({
    productImageCache: {
      cacheRemoteProductImage: async () => `/api/v1/uploads/${imageFileName}`
    }
  });
  t.after(async () => {
    const auditFilters = [
      ...(createdRecordId ? [{ entityType: "PurchaseRecord", entityId: createdRecordId }] : []),
      ...(createdUserIds.length > 0 ? [{ actorUserId: { in: createdUserIds } }] : [])
    ];
    if (auditFilters.length > 0) {
      await prisma.auditLog.deleteMany({ where: { OR: auditFilters } });
    }
    if (createdRecordId) {
      await prisma.purchaseRecord.deleteMany({ where: { id: createdRecordId } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await fs.rm(`${uploadsConfig.uploadDir}/${imageFileName}`, { force: true });
    await app.close();
    await prisma.$disconnect();
  });

  const requester = await prisma.user.create({
    data: { username: `image-owner-${randomUUID()}`, role: "user", status: "active" }
  });
  const otherRequester = await prisma.user.create({
    data: { username: `image-other-${randomUUID()}`, role: "user", status: "active" }
  });
  const itUser = await prisma.user.create({
    data: { username: `image-it-${randomUUID()}`, role: "it", status: "active" }
  });
  createdUserIds.push(requester.id, otherRequester.id, itUser.id);
  const tokenFor = (user) => signSessionToken({
    subject: user.id,
    payload: { username: user.username, role: user.role, status: user.status }
  }, config.jwt);

  const requesterToken = await tokenFor(requester);
  const otherToken = await tokenFor(otherRequester);
  const itToken = await tokenFor(itUser);
  const multipart = buildMultipartBody({
    fields: {
      reason: "Image access",
      itemsJson: JSON.stringify([{
        itemName: "Mouse",
        quantity: 1,
        marketplaceSource: {
          marketplace: "SHOPEE",
          sourceUrl: "https://shopee.com.my/product/1/2",
          imageUrl: "https://down-my.img.susercontent.com/file/mouse.webp",
          snapshot: { categoryPath: ["Mouse"] }
        }
      }])
    }
  });

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/v1/purchase-records",
    headers: {
      cookie: `it-hub-session=${requesterToken}`,
      "content-type": `multipart/form-data; boundary=${multipart.boundary}`
    },
    payload: multipart.payload
  });
  assert.equal(createResponse.statusCode, 200);
  createdRecordId = JSON.parse(createResponse.body).data.id;

  const ownerResponse = await app.inject({
    method: "GET",
    url: `/api/v1/uploads/${imageFileName}`,
    headers: { cookie: `it-hub-session=${requesterToken}` }
  });
  assert.equal(ownerResponse.statusCode, 200);

  const otherResponse = await app.inject({
    method: "GET",
    url: `/api/v1/uploads/${imageFileName}`,
    headers: { cookie: `it-hub-session=${otherToken}` }
  });
  assert.equal(otherResponse.statusCode, 403);

  const itResponse = await app.inject({
    method: "GET",
    url: `/api/v1/uploads/${imageFileName}`,
    headers: { cookie: `it-hub-session=${itToken}` }
  });
  assert.equal(itResponse.statusCode, 200);
});
