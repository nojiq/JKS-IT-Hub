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

async function build() {
    const app = Fastify();
    await app.register(appPlugin);
    return app;
}

let app;
let itUser, requester1, requester2;
let itToken, requester1Token;
let config;
let req1Id, req2Id, req3Id;

test("Requests Search API", async (t) => {
    // Overall Setup
    await t.test("Setup", async () => {
        config = getAuthConfig();
        app = await build();

        // Create IT User
        itUser = await prisma.user.create({
            data: { username: `it-search-${randomUUID()}`, role: "it", status: "active" }
        });

        // Create Requesters
        requester1 = await prisma.user.create({
            data: { username: `req1-search-${randomUUID()}`, role: "requester", status: "active" }
        });

        requester2 = await prisma.user.create({
            data: { username: `req2-search-${randomUUID()}`, role: "requester", status: "active" }
        });

        // Tokens
        itToken = await signSessionToken({
            subject: itUser.id,
            payload: { username: itUser.username, role: itUser.role, status: itUser.status }
        }, config.jwt);

        requester1Token = await signSessionToken({
            subject: requester1.id,
            payload: { username: requester1.username, role: requester1.role, status: requester1.status }
        }, config.jwt);

        // Create Test Requests
        const request1 = await prisma.itemRequest.create({
            data: {
                requesterId: requester1.id,
                itemName: "Dell Laptop XPS 15",
                description: "New laptop for development work",
                justification: "Need for coding",
                priority: "HIGH",
                category: "Hardware",
                status: "SUBMITTED"
            }
        });
        req1Id = request1.id;

        const request2 = await prisma.itemRequest.create({
            data: {
                requesterId: requester1.id,
                itemName: "Wireless Mouse",
                description: "Ergonomic mouse for office use",
                justification: "Better productivity",
                priority: "MEDIUM",
                category: "Hardware",
                status: "APPROVED"
            }
        });
        req2Id = request2.id;

        const request3 = await prisma.itemRequest.create({
            data: {
                requesterId: requester2.id,
                itemName: "Monitor 27 inch",
                description: "Dual monitor setup for designer",
                justification: "Design work",
                priority: "LOW",
                category: "Hardware",
                status: "SUBMITTED"
            }
        });
        req3Id = request3.id;
    });

    await t.test("GET /api/v1/requests with search by item name (case-insensitive)", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/requests?search=laptop",
            headers: { cookie: `it-hub-session=${itToken}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.ok(body.meta, "Should have meta object");
        assert.ok(body.meta.total >= 1, "Should find at least one laptop request");

        const laptopRequest = body.data.find(r => r.itemName === "Dell Laptop XPS 15");
        assert.ok(laptopRequest, "Should find the laptop request");
    });

    await t.test("GET /api/v1/requests with search by description", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/requests?search=ergonomic",
            headers: { cookie: `it-hub-session=${itToken}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.ok(body.meta.total >= 1, "Should find at least one ergonomic request");

        const mouseRequest = body.data.find(r => r.itemName === "Wireless Mouse");
        assert.ok(mouseRequest, "Should find the wireless mouse request");
    });

    await t.test("GET /api/v1/requests with search by requester username", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/v1/requests?search=${requester2.username}`,
            headers: { cookie: `it-hub-session=${itToken}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.ok(body.meta.total >= 1, "Should find at least one request by requester2");

        const monitorRequest = body.data.find(r => r.itemName === "Monitor 27 inch");
        assert.ok(monitorRequest, "Should find the monitor request");
    });

    await t.test("GET /api/v1/requests with search and status filter combined", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/v1/requests?search=${requester1.username}&status=SUBMITTED`,
            headers: { cookie: `it-hub-session=${itToken}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.ok(body.meta.total >= 1, "Should find at least one pending request by requester1");

        const laptopRequest = body.data.find(r => r.itemName === "Dell Laptop XPS 15");
        assert.ok(laptopRequest, "Should find the submitted laptop request");
        assert.equal(laptopRequest.status, "SUBMITTED");
    });

    await t.test("GET /api/v1/requests with search returns empty when no match", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/requests?search=nonexistentitem9999",
            headers: { cookie: `it-hub-session=${itToken}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.meta.total, 0, "Should find no results for nonexistent search");
        assert.deepEqual(body.data, []);
    });

    await t.test("GET /api/v1/requests/my-requests requester can search their own requests only", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/requests/my-requests?search=mouse",
            headers: { cookie: `it-hub-session=${requester1Token}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);

        // Requester1 should only see their own mouse request
        assert.ok(body.meta.total >= 1, "Should find at least one mouse request");
        const mouseRequest = body.data.find(r => r.itemName === "Wireless Mouse");
        assert.ok(mouseRequest, "Should find the mouse request");
        assert.equal(mouseRequest.requester.id, requester1.id, "Should be requester1's request");
        assert.ok(!body.data.some(r => r.requester.id === requester2.id), "Should not include other users' requests");
    });

    // Cleanup
    await t.test("Cleanup", async () => {
        if (req1Id) await prisma.itemRequest.delete({ where: { id: req1Id } });
        if (req2Id) await prisma.itemRequest.delete({ where: { id: req2Id } });
        if (req3Id) await prisma.itemRequest.delete({ where: { id: req3Id } });
        if (itUser) await prisma.user.delete({ where: { id: itUser.id } });
        if (requester1) await prisma.user.delete({ where: { id: requester1.id } });
        if (requester2) await prisma.user.delete({ where: { id: requester2.id } });
        await prisma.$disconnect();
        await app.close();
    });
});
