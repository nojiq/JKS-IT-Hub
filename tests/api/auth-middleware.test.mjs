
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");
import { requireAdminOrHead } from "../../apps/api/src/shared/auth/requireAdminOrHead.js";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";

const baseConfig = {
    jwt: {
        secret: "test-secret-test-secret",
        issuer: "it-hub",
        audience: "it-hub-web",
        expiresIn: "1h"
    },
    cookie: {
        name: "it-hub-session",
        secure: true,
        sameSite: "lax"
    }
};

const createInMemoryUserRepo = (initialUsers = []) => {
    const users = new Map(initialUsers.map((user) => [user.username, user]));
    return {
        findUserByUsername: async (username) => users.get(username) ?? null,
        isUserDisabled: (user) => user?.status === "disabled"
    };
};

const createTestApp = async ({ userRepo }) => {
    const app = Fastify({ logger: false });
    await app.register(cookie);

    app.get("/test-admin", async (req, reply) => {
        const user = await requireAdminOrHead(req, reply, {
            config: baseConfig,
            userRepo
        });
        if (!user) return; // Middleware handled the response
        return { status: "ok", role: user.role };
    });

    await app.ready();
    return app;
};

test("requireAdminOrHead allows admin", async () => {
    const user = { id: "u1", username: "admin", role: "admin", status: "active" };
    const userRepo = createInMemoryUserRepo([user]);
    const app = await createTestApp({ userRepo });

    const token = await signSessionToken({
        subject: user.id,
        payload: { username: user.username, role: user.role }
    }, baseConfig.jwt);

    const response = await app.inject({
        method: "GET",
        url: "/test-admin",
        headers: { cookie: `${baseConfig.cookie.name}=${token}` }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().status, "ok");
});

test("requireAdminOrHead allows head_it", async () => {
    const user = { id: "u2", username: "head", role: "head_it", status: "active" };
    const userRepo = createInMemoryUserRepo([user]);
    const app = await createTestApp({ userRepo });

    const token = await signSessionToken({
        subject: user.id,
        payload: { username: user.username, role: user.role }
    }, baseConfig.jwt);

    const response = await app.inject({
        method: "GET",
        url: "/test-admin",
        headers: { cookie: `${baseConfig.cookie.name}=${token}` }
    });

    assert.equal(response.statusCode, 200);
});

test("requireAdminOrHead blocks it user", async () => {
    const user = { id: "u3", username: "it", role: "it", status: "active" };
    const userRepo = createInMemoryUserRepo([user]);
    const app = await createTestApp({ userRepo });

    const token = await signSessionToken({
        subject: user.id,
        payload: { username: user.username, role: user.role }
    }, baseConfig.jwt);

    const response = await app.inject({
        method: "GET",
        url: "/test-admin",
        headers: { cookie: `${baseConfig.cookie.name}=${token}` }
    });

    assert.equal(response.statusCode, 403);
});

test("requireAdminOrHead blocks requester", async () => {
    const user = { id: "u4", username: "req", role: "requester", status: "active" };
    const userRepo = createInMemoryUserRepo([user]);
    const app = await createTestApp({ userRepo });

    const token = await signSessionToken({
        subject: user.id,
        payload: { username: user.username, role: user.role }
    }, baseConfig.jwt);

    const response = await app.inject({
        method: "GET",
        url: "/test-admin",
        headers: { cookie: `${baseConfig.cookie.name}=${token}` }
    });

    assert.equal(response.statusCode, 403);
});
