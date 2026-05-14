/* eslint-disable */
import "./bootstrap-database-env.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import credentialRoutes from "../../apps/api/src/features/credentials/routes.js";
import * as usersRepo from "../../apps/api/src/features/users/repo.js";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");

const config = {
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

const buildActor = (role = "it") => ({
    id: `actor-${role}`,
    username: `${role}.user`,
    role,
    status: "active"
});

const buildApp = async ({ role = "it" } = {}) => {
    const actor = buildActor(role);
    const app = Fastify({ logger: false });
    await app.register(cookie);

    const userRepo = {
        findUserByUsername: async (username) => (username === actor.username ? actor : null),
        isUserDisabled: (user) => user?.status === "disabled"
    };

    const credentialService = {
        loadImapWorkbench: async (userId) => ({
            user: { id: userId, username: "abdullah.fauzi", status: "active" },
            activeCredential: null,
            previousPasswordsCount: 1
        }),
        saveImapPassword: async () => ({
            user: { id: "user-1", username: "abdullah.fauzi", status: "active" },
            record: {
                id: "cred-1",
                isActive: true,
                metadata: {
                    mode: "provider_recorded",
                    saveMode: "active"
                }
            }
        }),
        listPreviousImapPasswords: async () => ([
            { id: "cred-1", isActive: true, metadata: { saveMode: "active" } },
            { id: "cred-2", isActive: false, metadata: { saveMode: "history_only" } }
        ])
    };

    await app.register(credentialRoutes, {
        prefix: "/api/v1/credentials",
        config,
        userRepo,
        credentialService,
        auditRepo: null
    });

    const token = await signSessionToken(
        {
            subject: actor.id,
            payload: {
                username: actor.username,
                role: actor.role,
                status: actor.status
            }
        },
        config.jwt
    );

    return {
        app,
        authHeader: { cookie: `${config.cookie.name}=${token}` }
    };
};

test("IMAP Generator API allows IT roles to load workbench state", async () => {
    const { app, authHeader } = await buildApp({ role: "it" });

    const response = await app.inject({
        method: "GET",
        url: "/api/v1/credentials/imap/users/user-1/workbench",
        headers: authHeader
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.user.id, "user-1");
    assert.equal(body.data.previousPasswordsCount, 1);
    assert.equal(body.data.activeCredential, null);
    await app.close();
});

test("IMAP Generator API rejects non-IT roles", async () => {
    const { app, authHeader } = await buildApp({ role: "requester" });

    const response = await app.inject({
        method: "GET",
        url: "/api/v1/credentials/imap/users/user-1/workbench",
        headers: authHeader
    });

    assert.equal(response.statusCode, 403);
    await app.close();
});

test("IMAP save API rejects missing password", async () => {
    const { app, authHeader } = await buildApp({ role: "it" });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credentials/imap/save",
        headers: authHeader,
        payload: {
            userId: "user-1",
            setActive: true
        }
    });

    assert.equal(response.statusCode, 400);
    await app.close();
});

test("Credential Generator API previews Yahoo actual passwords", async () => {
    const { app, authHeader } = await buildApp({ role: "it" });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credentials/actual-password/preview",
        headers: authHeader,
        payload: {
            fullName: "Test User",
            email: "test@example.com",
            dob: "1999-01-01",
            temporaryPassword: "yahooTemp1",
            length: 12,
            charset: {
                uppercase: true,
                lowercase: true,
                digit: true,
                special: true
            }
        }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.password.length, 12);
    assert.equal(body.data.metadata.mode, "yahoo_actual");
    await app.close();
});

test("Credential Generator API rejects invalid email on Yahoo actual preview", async () => {
    const { app, authHeader } = await buildApp({ role: "it" });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credentials/actual-password/preview",
        headers: authHeader,
        payload: {
            fullName: "Test User",
            email: "not-an-email",
            dob: "1999-01-01",
            temporaryPassword: "yahooTemp1",
            length: 12,
            charset: {
                uppercase: true,
                lowercase: true,
                digit: true,
                special: true
            }
        }
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.match(body.detail || "", /email/i);
    await app.close();
});

test("Credential Generator API rejects actual-password preview for non-IT roles", async () => {
    const { app, authHeader } = await buildApp({ role: "requester" });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credentials/actual-password/preview",
        headers: authHeader,
        payload: {
            fullName: "x",
            email: "x@x.co",
            dob: "1",
            temporaryPassword: "t",
            length: 8,
            charset: {
                uppercase: true,
                lowercase: true,
                digit: true,
                special: false
            }
        }
    });

    assert.equal(response.statusCode, 403);
    await app.close();
});

test("IMAP Generator API saves passwords with active mode", async () => {
    const { app, authHeader } = await buildApp({ role: "admin" });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credentials/imap/save",
        headers: authHeader,
        payload: {
            userId: "user-1",
            username: "abu@example.com",
            password: "From-Host-Provider-1",
            setActive: true
        }
    });

    assert.equal(response.statusCode, 201);
    const body = response.json();
    assert.equal(body.data.record.metadata.saveMode, "active");
    assert.equal(body.data.record.metadata.mode, "provider_recorded");
    await app.close();
});

test("IMAP Generator API accepts restoreCredentialId on save", async () => {
    const { app, authHeader } = await buildApp({ role: "admin" });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/credentials/imap/save",
        headers: authHeader,
        payload: {
            userId: "user-1",
            restoreCredentialId: "cred-archive",
            setActive: false
        }
    });

    assert.equal(response.statusCode, 201);
    await app.close();
});

test("IMAP Generator API lists previous passwords", async () => {
    const { app, authHeader } = await buildApp();

    const response = await app.inject({
        method: "GET",
        url: "/api/v1/credentials/imap/users/user-1/passwords",
        headers: authHeader
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.length, 2);
    assert.equal(body.data[1].metadata.saveMode, "history_only");
    await app.close();
});

test("listUsersFiltered searches LDAP names and IMAP profile fullName", async () => {
    const originalCount = usersRepo.prisma.user.count;
    const originalFindMany = usersRepo.prisma.user.findMany;
    const originalTransaction = usersRepo.prisma.$transaction;

    let countArgs = null;
    let findManyArgs = null;

    usersRepo.prisma.user.count = async (args) => {
        countArgs = args;
        return 0;
    };
    usersRepo.prisma.user.findMany = async (args) => {
        findManyArgs = args;
        return [];
    };
    usersRepo.prisma.$transaction = async (operations) => Promise.all(operations);

    try {
        await usersRepo.listUsersFiltered({ search: "abu" }, { page: 1, perPage: 20 });

        const where = findManyArgs.where;
        assert.equal(countArgs.where, where);
        assert.ok(where.OR.some((entry) => entry.ldapAttributes?.path === "$.displayName"));
        assert.ok(where.OR.some((entry) => entry.ldapAttributes?.path === "$.cn"));
        assert.ok(where.OR.some((entry) => entry.ldapAttributes?.path === "$.givenName"));
        assert.ok(where.OR.some((entry) => entry.ldapAttributes?.path === "$.sn"));
        assert.ok(where.OR.some((entry) => entry.imapProfile?.is?.fullName?.contains === "abu"));
        assert.ok(where.OR.some((entry) => entry.username?.contains === "abu"));
    } finally {
        usersRepo.prisma.user.count = originalCount;
        usersRepo.prisma.user.findMany = originalFindMany;
        usersRepo.prisma.$transaction = originalTransaction;
    }
});
