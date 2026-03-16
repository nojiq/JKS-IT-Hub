/* eslint-disable */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");

import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";
import { getAuthConfig } from "../../apps/api/src/config/authConfig.js";
import appPlugin from "../../apps/api/src/server.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

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

test("Requests Submission API", async (t) => {
    let app;
    let requesterUser;
    let disabledRequesterUser;
    let itUser;
    let requesterToken;
    let disabledRequesterToken;
    let itToken;
    let createdRequestId;
    let config;

    await t.test("Setup", async () => {
        config = getAuthConfig();
        app = await build();

        requesterUser = await prisma.user.create({
            data: {
                username: `requester-submit-${randomUUID()}`,
                role: "requester",
                status: "active"
            }
        });

        disabledRequesterUser = await prisma.user.create({
            data: {
                username: `requester-disabled-${randomUUID()}`,
                role: "requester",
                status: "disabled"
            }
        });

        itUser = await prisma.user.create({
            data: {
                username: `it-submit-${randomUUID()}`,
                role: "it",
                status: "active"
            }
        });

        requesterToken = await signSessionToken({
            subject: requesterUser.id,
            payload: { username: requesterUser.username, role: requesterUser.role, status: requesterUser.status }
        }, config.jwt);

        disabledRequesterToken = await signSessionToken({
            subject: disabledRequesterUser.id,
            payload: { username: disabledRequesterUser.username, role: disabledRequesterUser.role, status: disabledRequesterUser.status }
        }, config.jwt);

        itToken = await signSessionToken({
            subject: itUser.id,
            payload: { username: itUser.username, role: itUser.role, status: itUser.status }
        }, config.jwt);
    });

    await t.test("POST /api/v1/requests - rejects JSON submissions because e-invoice is required", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/requests",
            headers: { cookie: `it-hub-session=${requesterToken}` },
            payload: {
                itemName: "Dell Latitude",
                description: "Developer laptop",
                justification: "Required for daily work",
                priority: "HIGH",
                category: "Hardware"
            }
        });

        assert.equal(response.statusCode, 400);
        assert.match(response.headers["content-type"], /application\/problem\+json/);
        const body = JSON.parse(response.body);
        assert.equal(body.title, "Validation Error");
        assert.ok(Array.isArray(body.errors));
        assert.ok(body.errors.some((error) => error.field === "invoice"));
    });

    await t.test("POST /api/v1/requests/with-invoice - creates request with default status and audit log", async () => {
        const multipart = buildMultipartBody({
            fields: {
                itemName: "Dell Latitude",
                description: "Developer laptop",
                justification: "Required for daily work",
                priority: "HIGH",
                category: "Hardware"
            },
            file: {
                filename: "invoice.pdf",
                mimetype: "application/pdf",
                buffer: Buffer.from("%PDF-1.4 submission")
            }
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/requests/with-invoice",
            headers: {
                cookie: `it-hub-session=${requesterToken}`,
                "content-type": `multipart/form-data; boundary=${multipart.boundary}`
            },
            payload: multipart.payload
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.ok(body.data?.id);
        assert.equal(body.data.status, "SUBMITTED");
        assert.equal(body.data.requesterId, requesterUser.id);
        assert.ok(body.data.createdAt);
        assert.ok(body.data.invoiceFileUrl);
        createdRequestId = body.data.id;

        const requestCreatedAuditLog = await prisma.auditLog.findFirst({
            where: {
                action: "request_created",
                entityId: createdRequestId,
                actorUserId: requesterUser.id
            }
        });
        assert.ok(requestCreatedAuditLog, "request_created audit log should exist");

        const invoiceUploadedAuditLog = await prisma.auditLog.findFirst({
            where: {
                action: "invoice_uploaded",
                entityId: createdRequestId,
                actorUserId: requesterUser.id
            }
        });
        assert.ok(invoiceUploadedAuditLog, "invoice_uploaded audit log should exist");
    });

    await t.test("GET /api/v1/requests - IT user can see newly submitted request", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/requests?status=SUBMITTED&page=1&perPage=20",
            headers: { cookie: `it-hub-session=${itToken}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.ok(body.meta);
        assert.equal(typeof body.meta.totalPages, "number");
        assert.ok(body.data.some((request) => request.id === createdRequestId));
    });

    await t.test("POST /api/v1/requests/with-invoice - validation errors return RFC9457 format and do not create partial rows (missing item name)", async () => {
        const countBefore = await prisma.itemRequest.count({ where: { requesterId: requesterUser.id } });
        const multipart = buildMultipartBody({
            fields: {
                itemName: "",
                justification: "Need a device",
                priority: "MEDIUM"
            },
            file: {
                filename: "invoice.pdf",
                mimetype: "application/pdf",
                buffer: Buffer.from("%PDF-1.4 missing item")
            }
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/requests/with-invoice",
            headers: {
                cookie: `it-hub-session=${requesterToken}`,
                "content-type": `multipart/form-data; boundary=${multipart.boundary}`
            },
            payload: multipart.payload
        });

        assert.equal(response.statusCode, 400);
        assert.match(response.headers["content-type"], /application\/problem\+json/);

        const body = JSON.parse(response.body);
        assert.equal(body.title, "Validation Error");
        assert.equal(body.status, 400);
        assert.ok(Array.isArray(body.errors));
        assert.ok(body.errors.some((error) => error.field === "itemName"));

        const countAfter = await prisma.itemRequest.count({ where: { requesterId: requesterUser.id } });
        assert.equal(countAfter, countBefore);
    });

    await t.test("POST /api/v1/requests/with-invoice - validation errors return RFC9457 format and do not create partial rows (missing justification)", async () => {
        const countBefore = await prisma.itemRequest.count({ where: { requesterId: requesterUser.id } });
        const multipart = buildMultipartBody({
            fields: {
                itemName: "Keyboard",
                justification: "",
                priority: "MEDIUM"
            },
            file: {
                filename: "invoice.pdf",
                mimetype: "application/pdf",
                buffer: Buffer.from("%PDF-1.4 missing justification")
            }
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/requests/with-invoice",
            headers: {
                cookie: `it-hub-session=${requesterToken}`,
                "content-type": `multipart/form-data; boundary=${multipart.boundary}`
            },
            payload: multipart.payload
        });

        assert.equal(response.statusCode, 400);
        const body = JSON.parse(response.body);
        assert.equal(body.title, "Validation Error");
        assert.ok(Array.isArray(body.errors));
        assert.ok(body.errors.some((error) => error.field === "justification"));

        const countAfter = await prisma.itemRequest.count({ where: { requesterId: requesterUser.id } });
        assert.equal(countAfter, countBefore);
    });

    await t.test("POST /api/v1/requests/with-invoice - invalid priority rejected", async () => {
        const multipart = buildMultipartBody({
            fields: {
                itemName: "Mouse",
                justification: "Need replacement",
                priority: "P1"
            },
            file: {
                filename: "invoice.pdf",
                mimetype: "application/pdf",
                buffer: Buffer.from("%PDF-1.4 invalid priority")
            }
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/requests/with-invoice",
            headers: {
                cookie: `it-hub-session=${requesterToken}`,
                "content-type": `multipart/form-data; boundary=${multipart.boundary}`
            },
            payload: multipart.payload
        });

        assert.equal(response.statusCode, 400);
        const body = JSON.parse(response.body);
        assert.equal(body.title, "Validation Error");
        assert.ok(Array.isArray(body.errors));
        assert.ok(body.errors.some((error) => error.field === "priority"));
    });

    await t.test("POST /api/v1/requests/with-invoice - exceeding item name max length rejected", async () => {
        const multipart = buildMultipartBody({
            fields: {
                itemName: "x".repeat(201),
                justification: "Need replacement",
                priority: "LOW"
            },
            file: {
                filename: "invoice.pdf",
                mimetype: "application/pdf",
                buffer: Buffer.from("%PDF-1.4 long name")
            }
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/requests/with-invoice",
            headers: {
                cookie: `it-hub-session=${requesterToken}`,
                "content-type": `multipart/form-data; boundary=${multipart.boundary}`
            },
            payload: multipart.payload
        });

        assert.equal(response.statusCode, 400);
        const body = JSON.parse(response.body);
        assert.equal(body.title, "Validation Error");
        assert.ok(Array.isArray(body.errors));
        assert.ok(body.errors.some((error) => error.field === "itemName"));
    });

    await t.test("POST /api/v1/requests/with-invoice - disabled users cannot submit", async () => {
        const multipart = buildMultipartBody({
            fields: {
                itemName: "Docking Station",
                justification: "Need for office setup",
                priority: "MEDIUM"
            },
            file: {
                filename: "invoice.pdf",
                mimetype: "application/pdf",
                buffer: Buffer.from("%PDF-1.4 disabled user")
            }
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/requests/with-invoice",
            headers: {
                cookie: `it-hub-session=${disabledRequesterToken}`,
                "content-type": `multipart/form-data; boundary=${multipart.boundary}`
            },
            payload: multipart.payload
        });

        assert.equal(response.statusCode, 403);
    });

    await t.test("Cleanup", async () => {
        const userIds = [requesterUser?.id, disabledRequesterUser?.id, itUser?.id].filter(Boolean);
        const ids = [createdRequestId].filter(Boolean);
        if (ids.length > 0) {
            await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
            await prisma.itemRequest.deleteMany({ where: { id: { in: ids } } });
        }

        if (userIds.length > 0) {
            await prisma.emailNotification.deleteMany({
                where: {
                    OR: [
                        { recipientUserId: { in: userIds } },
                        { referenceId: { in: ids } }
                    ]
                }
            });
            await prisma.inAppNotification.deleteMany({
                where: {
                    OR: [
                        { userId: { in: userIds } },
                        { referenceId: { in: ids } }
                    ]
                }
            });
        }

        if (requesterUser) {
            await prisma.user.delete({ where: { id: requesterUser.id } });
        }
        if (disabledRequesterUser) {
            await prisma.user.delete({ where: { id: disabledRequesterUser.id } });
        }
        if (itUser) {
            await prisma.user.delete({ where: { id: itUser.id } });
        }

        await prisma.$disconnect();
        await app.close();
    });
});
