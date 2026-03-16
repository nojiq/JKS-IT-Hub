import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");

import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";
import { getAuthConfig } from "../../apps/api/src/config/authConfig.js";
import appPlugin from "../../apps/api/src/server.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

async function build() {
    const app = Fastify();
    await app.register(appPlugin);
    return app;
}

let app;
let requester1, requester2, itUser, adminUser;
let req1Token, req2Token, itToken, adminToken;
let config;
let request1Id, request2Id;

test("Requests Details API", async (t) => {
    // Overall Setup
    await t.test("Setup", async () => {
        config = getAuthConfig();
        app = await build();

        // Create Users
        requester1 = await prisma.user.create({
            data: { username: `req1-${randomUUID()}`, role: "requester", status: "active" }
        });
        requester2 = await prisma.user.create({
            data: { username: `req2-${randomUUID()}`, role: "requester", status: "active" }
        });
        itUser = await prisma.user.create({
            data: { username: `it-${randomUUID()}`, role: "it", status: "active" }
        });
        adminUser = await prisma.user.create({
            data: { username: `admin-${randomUUID()}`, role: "admin", status: "active" }
        });

        // Tokens
        const generateToken = async (user) => {
            return signSessionToken({
                subject: user.id,
                payload: { username: user.username, role: user.role }
            }, config.jwt);
        };

        req1Token = await generateToken(requester1);
        req2Token = await generateToken(requester2);
        itToken = await generateToken(itUser);
        adminToken = await generateToken(adminUser);

        // Create Requests
        // Request 1: Fully populated with review and approval
        const req1 = await prisma.itemRequest.create({
            data: {
                requesterId: requester1.id,
                itemName: "Laptop Request",
                description: "Need a new laptop",
                justification: "Old one is slow",
                priority: "HIGH",
                category: "Hardware",
                status: "APPROVED",
                itReview: "Looks good",
                itReviewedById: itUser.id,
                itReviewedAt: new Date(),
                approvedById: adminUser.id,
                approvedAt: new Date(),
                invoiceFileUrl: "/uploads/invoice.pdf"
            }
        });
        request1Id = req1.id;

        // Request 2: Rejected
        const req2 = await prisma.itemRequest.create({
            data: {
                requesterId: requester2.id,
                itemName: "Mouse Request",
                description: "Need a mouse",
                justification: "Old one broke",
                priority: "LOW",
                category: "Peripherals",
                status: "REJECTED",
                rejectionReason: "Too expensive",
                itReviewedById: itUser.id,
                itReviewedAt: new Date()
            }
        });
        request2Id = req2.id;
    });

    await t.test("GET /api/v1/requests/:id - Requester sees own request with all details", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/v1/requests/${request1Id}`,
            headers: { cookie: `it-hub-session=${req1Token}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        const data = body.data;

        assert.equal(data.id, request1Id);
        assert.equal(data.itemName, "Laptop Request");
        assert.equal(data.status, "APPROVED");
        assert.equal(data.itReview, "Looks good");
        assert.equal(data.itReviewedBy.id, itUser.id);
        assert.ok(data.itReviewedAt);
        assert.equal(data.approvedBy.id, adminUser.id);
        assert.ok(data.approvedAt);
        assert.equal(data.invoiceFileUrl, "/uploads/invoice.pdf");
    });

    await t.test("GET /api/v1/requests/:id - Requester CANNOT see other's request", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/v1/requests/${request2Id}`, // Request 2 belongs to Requester 2
            headers: { cookie: `it-hub-session=${req1Token}` } // Requester 1 tries to access
        });

        assert.equal(response.statusCode, 403);
    });

    await t.test("GET /api/v1/requests/:id - IT User can see any request", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/v1/requests/${request1Id}`,
            headers: { cookie: `it-hub-session=${itToken}` }
        });

        assert.equal(response.statusCode, 200);
    });

    await t.test("GET /api/v1/requests/:id - Admin User can see any request", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/v1/requests/${request2Id}`,
            headers: { cookie: `it-hub-session=${adminToken}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        const data = body.data;

        assert.equal(data.id, request2Id);
        assert.equal(data.status, "REJECTED");
        assert.equal(data.rejectionReason, "Too expensive");
    });

    // Cleanup
    await t.test("Cleanup", async () => {
        if (request1Id) await prisma.itemRequest.delete({ where: { id: request1Id } });
        if (request2Id) await prisma.itemRequest.delete({ where: { id: request2Id } });
        if (requester1) await prisma.user.delete({ where: { id: requester1.id } });
        if (requester2) await prisma.user.delete({ where: { id: requester2.id } });
        if (itUser) await prisma.user.delete({ where: { id: itUser.id } });
        if (adminUser) await prisma.user.delete({ where: { id: adminUser.id } });

        await prisma.$disconnect();
        await app.close();
    });
});
