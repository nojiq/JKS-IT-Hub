/* eslint-disable */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path, { dirname, join } from "node:path";
import fs from "node:fs/promises";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");

import appPlugin from "../../apps/api/src/server.js";
import { getAuthConfig } from "../../apps/api/src/config/authConfig.js";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_UPLOAD_DIR = join(__dirname, "../../apps/api/test-uploads-api");

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

    return {
        boundary,
        payload: Buffer.concat(chunks)
    };
};

async function build() {
    const app = Fastify();
    await app.register(appPlugin);
    return app;
}

test("Requests Invoice Upload API", async (t) => {
    const previousUploadDir = process.env.UPLOAD_DIR;
    process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;

    const config = getAuthConfig();
    const app = await build();
    const { uploadsConfig } = await import("../../apps/api/src/config/uploads.js");
    const activeUploadDir = path.isAbsolute(uploadsConfig.uploadDir)
        ? uploadsConfig.uploadDir
        : path.join(process.cwd(), uploadsConfig.uploadDir);

    let ownerUser;
    let otherRequester;
    let itUser;
    let ownerToken;
    let otherToken;
    let itToken;
    const createdRequestIds = [];

    await t.test("setup users and tokens", async () => {
        ownerUser = await prisma.user.create({
            data: {
                username: `invoice-owner-${randomUUID()}`,
                role: "requester",
                status: "active"
            }
        });
        otherRequester = await prisma.user.create({
            data: {
                username: `invoice-other-${randomUUID()}`,
                role: "requester",
                status: "active"
            }
        });
        itUser = await prisma.user.create({
            data: {
                username: `invoice-it-${randomUUID()}`,
                role: "it",
                status: "active"
            }
        });

        ownerToken = await signSessionToken({
            subject: ownerUser.id,
            payload: { username: ownerUser.username, role: ownerUser.role, status: ownerUser.status }
        }, config.jwt);
        otherToken = await signSessionToken({
            subject: otherRequester.id,
            payload: { username: otherRequester.username, role: otherRequester.role, status: otherRequester.status }
        }, config.jwt);
        itToken = await signSessionToken({
            subject: itUser.id,
            payload: { username: itUser.username, role: itUser.role, status: itUser.status }
        }, config.jwt);
    });

    await t.test("owner can upload invoice to existing request; status unchanged and audit log written", async () => {
        const request = await prisma.itemRequest.create({
            data: {
                requesterId: ownerUser.id,
                itemName: "USB-C Dock",
                justification: "Needed for workstation setup",
                status: "SUBMITTED"
            }
        });
        createdRequestIds.push(request.id);

        const multipart = buildMultipartBody({
            file: {
                filename: "invoice.pdf",
                mimetype: "application/pdf",
                buffer: Buffer.from("%PDF-1.4 test invoice file")
            }
        });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${request.id}/invoice`,
            headers: {
                cookie: `${config.cookie.name}=${ownerToken}`,
                "content-type": `multipart/form-data; boundary=${multipart.boundary}`
            },
            payload: multipart.payload
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.ok(body.data?.invoiceFileUrl);
        assert.match(body.data.invoiceFileUrl, /^\/api\/v1\/uploads\/[0-9a-f-]+\.pdf$/);

        const refreshed = await prisma.itemRequest.findUnique({ where: { id: request.id } });
        assert.equal(refreshed.status, "SUBMITTED");
        assert.equal(refreshed.invoiceFileUrl, body.data.invoiceFileUrl);

        const auditLog = await prisma.auditLog.findFirst({
            where: {
                action: "invoice_uploaded",
                actorUserId: ownerUser.id,
                entityId: request.id
            }
        });
        assert.ok(auditLog, "invoice_uploaded audit log should exist");
    });

    await t.test("non-owner requester and IT role cannot upload invoice to someone else's request", async () => {
        const request = await prisma.itemRequest.create({
            data: {
                requesterId: ownerUser.id,
                itemName: "Wireless Mouse",
                justification: "Current device failed",
                status: "SUBMITTED"
            }
        });
        createdRequestIds.push(request.id);

        const multipart = buildMultipartBody({
            file: {
                filename: "invoice.png",
                mimetype: "image/png",
                buffer: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A])
            }
        });

        const otherRequesterResponse = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${request.id}/invoice`,
            headers: {
                cookie: `${config.cookie.name}=${otherToken}`,
                "content-type": `multipart/form-data; boundary=${multipart.boundary}`
            },
            payload: multipart.payload
        });
        assert.equal(otherRequesterResponse.statusCode, 403);

        const itResponse = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${request.id}/invoice`,
            headers: {
                cookie: `${config.cookie.name}=${itToken}`,
                "content-type": `multipart/form-data; boundary=${multipart.boundary}`
            },
            payload: multipart.payload
        });
        assert.equal(itResponse.statusCode, 403);
    });

    await t.test("invalid file type is rejected with RFC9457 validation error", async () => {
        const request = await prisma.itemRequest.create({
            data: {
                requesterId: ownerUser.id,
                itemName: "Keyboard",
                justification: "Need replacement",
                status: "SUBMITTED"
            }
        });
        createdRequestIds.push(request.id);

        const multipart = buildMultipartBody({
            file: {
                filename: "invoice.exe",
                mimetype: "application/x-msdownload",
                buffer: Buffer.from("MZ...")
            }
        });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${request.id}/invoice`,
            headers: {
                cookie: `${config.cookie.name}=${ownerToken}`,
                "content-type": `multipart/form-data; boundary=${multipart.boundary}`
            },
            payload: multipart.payload
        });

        assert.equal(response.statusCode, 400);
        assert.match(response.headers["content-type"], /application\/problem\+json/);
        const body = JSON.parse(response.body);
        assert.equal(body.title, "Validation Error");
        assert.ok(Array.isArray(body.errors));
        assert.equal(body.errors[0].field, "invoice");
    });

    await t.test("with-invoice endpoint rejects request when invoice file is missing", async () => {
        const countBefore = await prisma.itemRequest.count({
            where: { requesterId: ownerUser.id }
        });

        const multipart = buildMultipartBody({
            fields: {
                itemName: "Desk Lamp",
                justification: "Need focused lighting",
                priority: "LOW",
                category: "Accessories"
            }
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/requests/with-invoice",
            headers: {
                cookie: `${config.cookie.name}=${ownerToken}`,
                "content-type": `multipart/form-data; boundary=${multipart.boundary}`
            },
            payload: multipart.payload
        });

        assert.equal(response.statusCode, 400);
        assert.match(response.headers["content-type"], /application\/problem\+json/);
        const body = JSON.parse(response.body);
        assert.equal(body.title, "Validation Error");
        assert.ok(Array.isArray(body.errors));
        assert.ok(body.errors.some((error) => error.field === "invoice"));

        const countAfter = await prisma.itemRequest.count({
            where: { requesterId: ownerUser.id }
        });
        assert.equal(countAfter, countBefore);
    });

    await t.test("with-invoice endpoint creates request and uploads invoice in one call", async () => {
        const multipart = buildMultipartBody({
            fields: {
                itemName: "Laptop Sleeve",
                justification: "Protection for transported device",
                priority: "MEDIUM",
                category: "Accessories"
            },
            file: {
                filename: "single-call.pdf",
                mimetype: "application/pdf",
                buffer: Buffer.from("%PDF-1.4 from with-invoice")
            }
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/requests/with-invoice",
            headers: {
                cookie: `${config.cookie.name}=${ownerToken}`,
                "content-type": `multipart/form-data; boundary=${multipart.boundary}`
            },
            payload: multipart.payload
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.ok(body.data?.id);
        assert.equal(body.data.requesterId, ownerUser.id);
        assert.ok(body.data.invoiceFileUrl);
        createdRequestIds.push(body.data.id);
    });

    await t.test("file serving requires auth and enforces request-level authorization", async () => {
        const request = await prisma.itemRequest.create({
            data: {
                requesterId: ownerUser.id,
                itemName: "Monitor Arm",
                justification: "Ergonomics",
                status: "SUBMITTED"
            }
        });
        createdRequestIds.push(request.id);

        const uploadMultipart = buildMultipartBody({
            file: {
                filename: "served-file.pdf",
                mimetype: "application/pdf",
                buffer: Buffer.from("%PDF-1.4 served file")
            }
        });
        const uploadResponse = await app.inject({
            method: "POST",
            url: `/api/v1/requests/${request.id}/invoice`,
            headers: {
                cookie: `${config.cookie.name}=${ownerToken}`,
                "content-type": `multipart/form-data; boundary=${uploadMultipart.boundary}`
            },
            payload: uploadMultipart.payload
        });
        assert.equal(uploadResponse.statusCode, 200);
        const uploadBody = JSON.parse(uploadResponse.body);
        const invoiceUrl = uploadBody.data.invoiceFileUrl;

        const anonymousResponse = await app.inject({
            method: "GET",
            url: invoiceUrl
        });
        assert.equal(anonymousResponse.statusCode, 401);

        const otherRequesterResponse = await app.inject({
            method: "GET",
            url: invoiceUrl,
            headers: {
                cookie: `${config.cookie.name}=${otherToken}`
            }
        });
        assert.equal(otherRequesterResponse.statusCode, 403);

        const ownerResponse = await app.inject({
            method: "GET",
            url: invoiceUrl,
            headers: {
                cookie: `${config.cookie.name}=${ownerToken}`
            }
        });
        assert.equal(ownerResponse.statusCode, 200);

        const itResponse = await app.inject({
            method: "GET",
            url: invoiceUrl,
            headers: {
                cookie: `${config.cookie.name}=${itToken}`
            }
        });
        assert.equal(itResponse.statusCode, 200);
    });

    await t.test("cleanup", async () => {
        if (createdRequestIds.length > 0) {
            await prisma.auditLog.deleteMany({
                where: { entityId: { in: createdRequestIds } }
            });
            await prisma.itemRequest.deleteMany({
                where: { id: { in: createdRequestIds } }
            });
        }

        if (ownerUser?.id || otherRequester?.id || itUser?.id) {
            const userIds = [ownerUser?.id, otherRequester?.id, itUser?.id].filter(Boolean);
            await prisma.emailNotification.deleteMany({
                where: {
                    OR: [
                        { recipientUserId: { in: userIds } },
                        { referenceId: { in: createdRequestIds } }
                    ]
                }
            });
            await prisma.inAppNotification.deleteMany({
                where: {
                    OR: [
                        { userId: { in: userIds } },
                        { referenceId: { in: createdRequestIds } }
                    ]
                }
            });
            await prisma.user.deleteMany({
                where: { id: { in: userIds } }
            });
        }

        await fs.rm(activeUploadDir, { recursive: true, force: true });
        if (previousUploadDir === undefined) {
            delete process.env.UPLOAD_DIR;
        } else {
            process.env.UPLOAD_DIR = previousUploadDir;
        }

        await prisma.$disconnect();
        await app.close();
    });
});
