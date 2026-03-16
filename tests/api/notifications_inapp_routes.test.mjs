/* eslint-disable */
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
let user1, user2;
let token1, token2;
let config;

before(async () => {
    config = getAuthConfig();
    app = await build();

    // Create User 1
    user1 = await prisma.user.create({
        data: {
            username: `user1-${randomUUID()}`,
            role: "requester",
            status: "active"
        }
    });

    // Create User 2
    user2 = await prisma.user.create({
        data: {
            username: `user2-${randomUUID()}`,
            role: "requester",
            status: "active"
        }
    });

    // Tokens
    token1 = await signSessionToken({
        subject: user1.id,
        payload: { username: user1.username, role: user1.role }
    }, config.jwt);

    token2 = await signSessionToken({
        subject: user2.id,
        payload: { username: user2.username, role: user2.role }
    }, config.jwt);
});

after(async () => {
    // Cleanup
    const userIds = [user1.id, user2.id];

    // Cleanup notifications
    try {
        await prisma.inAppNotification.deleteMany({
            where: { userId: { in: userIds } }
        });
    } catch (e) { console.error(e); }

    // Cleanup users
    try {
        await prisma.user.deleteMany({
            where: { id: { in: userIds } }
        });
    } catch (e) {
        console.log("Cleanup: User deletion skipped due to constraints");
    }

    await prisma.$disconnect();
    await app.close();
});

test("In-App Notifications API", async (t) => {

    await t.test("1. List notifications (empty initially)", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/notifications",
            headers: { cookie: `it-hub-session=${token1}` }
        });

        assert.equal(response.statusCode, 200, "Should handle GET /api/v1/notifications");
        const body = JSON.parse(response.body);
        assert.equal(body.data.length, 0);
        assert.equal(body.meta.total, 0);
    });

    await t.test("2. Seed notifications and list again", async () => {
        // Create 3 notifications for user1 (2 unread, 1 read)
        await prisma.inAppNotification.createMany({
            data: [
                {
                    userId: user1.id,
                    title: "Notif 1",
                    message: "Msg 1",
                    type: "info",
                    isRead: false
                },
                {
                    userId: user1.id,
                    title: "Notif 2",
                    message: "Msg 2",
                    type: "info",
                    isRead: false
                },
                {
                    userId: user1.id,
                    title: "Notif 3",
                    message: "Msg 3",
                    type: "info",
                    isRead: true,
                    readAt: new Date()
                }
            ]
        });

        // Create 1 notification for user2
        await prisma.inAppNotification.create({
            data: {
                userId: user2.id,
                title: "Notif User 2",
                message: "Msg User 2",
                type: "info",
                isRead: false
            }
        });

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/notifications",
            headers: { cookie: `it-hub-session=${token1}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.length, 3);
        assert.equal(body.meta.total, 3);
    });

    await t.test("3. Get unread count", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/notifications/unread-count",
            headers: { cookie: `it-hub-session=${token1}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.count, 2);
    });

    await t.test(" filtered by isRead status", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/notifications?isRead=false",
            headers: { cookie: `it-hub-session=${token1}` }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.data.length, 2);

        const responseRead = await app.inject({
            method: "GET",
            url: "/api/v1/notifications?isRead=true",
            headers: { cookie: `it-hub-session=${token1}` }
        });

        assert.equal(responseRead.statusCode, 200);
        const bodyRead = JSON.parse(responseRead.body);
        assert.equal(bodyRead.data.length, 1);
    });

    await t.test("5. Mark single as read", async () => {
        // Get an unread notification first
        const listResponse = await app.inject({
            method: "GET",
            url: "/api/v1/notifications?isRead=false",
            headers: { cookie: `it-hub-session=${token1}` }
        });
        const notifId = JSON.parse(listResponse.body).data[0].id;

        const response = await app.inject({
            method: "PUT",
            url: `/api/v1/notifications/${notifId}/read`,
            headers: { cookie: `it-hub-session=${token1}` }
        });

        assert.equal(response.statusCode, 200);

        // Verify count decreased
        const countResponse = await app.inject({
            method: "GET",
            url: "/api/v1/notifications/unread-count",
            headers: { cookie: `it-hub-session=${token1}` }
        });
        assert.equal(JSON.parse(countResponse.body).data.count, 1);
    });

    await t.test("6. Mark all as read", async () => {
        const response = await app.inject({
            method: "PUT",
            url: "/api/v1/notifications/read-all",
            headers: { cookie: `it-hub-session=${token1}` }
        });

        assert.equal(response.statusCode, 200);

        // Verify count is 0
        const countResponse = await app.inject({
            method: "GET",
            url: "/api/v1/notifications/unread-count",
            headers: { cookie: `it-hub-session=${token1}` }
        });
        assert.equal(JSON.parse(countResponse.body).data.count, 0);
    });

    await t.test("7. Cannot read another user's notification", async () => {
        // Get user1 notification
        const notifications1 = await prisma.inAppNotification.findMany({
            where: { userId: user1.id }
        });
        const notifId = notifications1[0].id;

        // Try to read with user2 token
        const response = await app.inject({
            method: "PUT",
            url: `/api/v1/notifications/${notifId}/read`,
            headers: { cookie: `it-hub-session=${token2}` }
        });

        assert.equal(response.statusCode, 403);
    });
});
