import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");
import ldapRoutes from "../../apps/api/src/features/ldap/routes.js";
import {
  createLdapSyncRunner,
  LdapSyncInProgressError
} from "../../apps/api/src/features/ldap/syncService.js";
import { buildLdapSyncEvent, createLdapSyncEventChannel } from "../../apps/api/src/features/ldap/syncEvents.js";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";

const baseConfig = {
  ldap: {
    url: "ldaps://ldap.example.com:636",
    baseDn: "dc=example,dc=com",
    bindDn: "cn=bind,dc=example,dc=com",
    bindPassword: "secret",
    userFilter: "(uid={{username}})",
    useStartTls: false,
    rejectUnauthorized: true,
    tlsCaPath: undefined,
    timeoutMs: 5000,
    connectTimeoutMs: 5000
  },
  ldapSync: {
    filter: "(objectClass=person)",
    attributes: ["uid", "cn", "mail"],
    usernameAttribute: "uid",
    pageSize: undefined
  },
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
  },
  cors: {
    origin: "http://localhost:5176"
  }
};

const createInMemoryUserRepo = (initialUsers = []) => {
  const users = new Map(initialUsers.map((user) => [user.username, user]));

  return {
    findUserByUsername: async (username) => users.get(username) ?? null,
    findUsersByUsernames: async (usernames = []) => {
      return [...new Set(usernames)].map((username) => ({ username })).filter((item) => users.has(item.username));
    },
    isUserDisabled: (user) => user?.status === "disabled"
  };
};

const createInMemorySyncRepo = (runs = []) => {
  let nextId = runs.length + 1;
  const state = [...runs];

  return {
    createSyncRun: async (data) => {
      const run = {
        id: data.id ?? `run-${nextId++}`,
        status: data.status ?? "started",
        startedAt: data.startedAt ?? new Date(),
        completedAt: data.completedAt ?? null,
        processedCount: data.processedCount ?? 0,
        createdCount: data.createdCount ?? 0,
        updatedCount: data.updatedCount ?? 0,
        skippedCount: data.skippedCount ?? 0,
        errorMessage: data.errorMessage ?? null,
        triggeredByUserId: data.triggeredByUserId
      };
      state.push(run);
      return run;
    },
    updateSyncRun: async (id, updates) => {
      const index = state.findIndex((run) => run.id === id);
      if (index === -1) {
        throw new Error("Run not found");
      }
      state[index] = { ...state[index], ...updates };
      return state[index];
    },
    getLatestSyncRun: async () => {
      if (!state.length) {
        return null;
      }
      return [...state].sort((a, b) => b.startedAt - a.startedAt)[0];
    }
  };
};

const createSessionCookie = async (user) => {
  const token = await signSessionToken(
    {
      subject: user.id,
      payload: {
        username: user.username,
        role: user.role,
        status: user.status
      }
    },
    baseConfig.jwt
  );

  return `${baseConfig.cookie.name}=${token}`;
};

const createTestApp = async ({ syncRunner, userRepo, syncRepo, auditRepo } = {}) => {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  await app.register(ldapRoutes, {
    config: baseConfig,
    syncRunner,
    userRepo,
    syncRepo: syncRepo ?? createInMemorySyncRepo(),
    auditRepo: auditRepo ?? { createAuditLog: async () => ({}) }
  });
  await app.ready();
  return app;
};

const waitFor = async (predicate, { retries = 20, delayMs = 10 } = {}) => {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    if (await predicate()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
};

test("POST /ldap/sync requires authentication", async () => {
  const app = await createTestApp({
    syncRunner: { startManualSync: async () => ({}) },
    userRepo: createInMemoryUserRepo(),
    syncRepo: createInMemorySyncRepo()
  });

  const response = await app.inject({
    method: "POST",
    url: "/ldap/sync"
  });

  assert.equal(response.statusCode, 401);
  const body = response.json();
  assert.equal(body.title, "Unauthorized");

  await app.close();
});

test("POST /ldap/sync forbids non-IT roles", async () => {
  const user = {
    id: "user-1",
    username: "requester",
    role: "requester",
    status: "active"
  };
  const app = await createTestApp({
    syncRunner: { startManualSync: async () => ({}) },
    userRepo: createInMemoryUserRepo([user]),
    syncRepo: createInMemorySyncRepo()
  });

  const response = await app.inject({
    method: "POST",
    url: "/ldap/sync",
    headers: {
      cookie: await createSessionCookie(user)
    }
  });

  assert.equal(response.statusCode, 403);
  const body = response.json();
  assert.equal(body.title, "Forbidden");

  await app.close();
});

test("POST /ldap/sync returns started run for IT", async () => {
  const user = {
    id: "user-2",
    username: "it-user",
    role: "it",
    status: "active"
  };
  const syncRepo = createInMemorySyncRepo();
  const syncRunner = {
    startManualSync: async ({ actor }) => {
      return syncRepo.createSyncRun({
        status: "started",
        triggeredByUserId: actor.id
      });
    }
  };
  const app = await createTestApp({
    syncRunner,
    userRepo: createInMemoryUserRepo([user]),
    syncRepo
  });

  const response = await app.inject({
    method: "POST",
    url: "/ldap/sync",
    headers: {
      cookie: await createSessionCookie(user)
    }
  });

  assert.equal(response.statusCode, 202);
  const body = response.json();
  assert.equal(body.data.run.status, "started");
  assert.equal(body.data.run.triggeredByUserId, user.id);

  await app.close();
});

test("POST /ldap/sync reports sync start failures", async () => {
  const user = {
    id: "user-3",
    username: "admin",
    role: "admin",
    status: "active"
  };
  const app = await createTestApp({
    syncRunner: {
      startManualSync: async () => {
        throw new Error("LDAP unreachable");
      }
    },
    userRepo: createInMemoryUserRepo([user]),
    syncRepo: createInMemorySyncRepo()
  });

  const response = await app.inject({
    method: "POST",
    url: "/ldap/sync",
    headers: {
      cookie: await createSessionCookie(user)
    }
  });

  assert.equal(response.statusCode, 502);
  const body = response.json();
  assert.equal(body.title, "Sync unavailable");

  await app.close();
});

test("POST /ldap/sync returns conflict when a sync is already running", async () => {
  const user = {
    id: "user-5",
    username: "it-user",
    role: "it",
    status: "active"
  };
  const app = await createTestApp({
    syncRunner: {
      startManualSync: async () => {
        throw new LdapSyncInProgressError();
      }
    },
    userRepo: createInMemoryUserRepo([user]),
    syncRepo: createInMemorySyncRepo()
  });

  const response = await app.inject({
    method: "POST",
    url: "/ldap/sync",
    headers: {
      cookie: await createSessionCookie(user)
    }
  });

  assert.equal(response.statusCode, 409);
  const body = response.json();
  assert.equal(body.title, "Sync already running");

  await app.close();
});

test("GET /ldap/sync/latest returns latest sync run", async () => {
  const user = {
    id: "user-4",
    username: "head-it",
    role: "head_it",
    status: "active"
  };
  const syncRepo = createInMemorySyncRepo([
    {
      id: "run-1",
      status: "completed",
      startedAt: new Date("2026-01-01T10:00:00Z"),
      completedAt: new Date("2026-01-01T10:10:00Z"),
      processedCount: 5,
      createdCount: 2,
      updatedCount: 3,
      skippedCount: 0,
      triggeredByUserId: user.id
    }
  ]);
  const app = await createTestApp({
    syncRunner: { startManualSync: async () => ({}) },
    userRepo: createInMemoryUserRepo([user]),
    syncRepo
  });

  const response = await app.inject({
    method: "GET",
    url: "/ldap/sync/latest",
    headers: {
      cookie: await createSessionCookie(user)
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.data.run.id, "run-1");
  assert.equal(body.data.run.status, "completed");

  await app.close();
});

test("manual sync records failure error message", async () => {
  const syncRepo = createInMemorySyncRepo();
  const userRepo = {
    ...createInMemoryUserRepo(),
    upsertUserFromLdap: async () => ({})
  };
  const runner = createLdapSyncRunner({
    config: baseConfig,
    ldapService: {
      searchEntries: async () => {
        throw new Error("LDAP bind timeout");
      }
    },
    syncRepo,
    userRepo,
    auditRepo: { createAuditLog: async () => ({}) },
    eventChannel: null
  });

  await runner.startManualSync({ actor: { id: "user-6" } });

  const completed = await waitFor(async () => {
    const latest = await syncRepo.getLatestSyncRun();
    return latest?.status === "failed";
  });

  assert.equal(completed, true);
  const latest = await syncRepo.getLatestSyncRun();
  assert.equal(latest.status, "failed");
  assert.ok(latest.errorMessage.includes("LDAP bind timeout"));
});

test("LDAP sync event channel publishes events", async () => {
  const channel = createLdapSyncEventChannel();
  const stream = channel.subscribe();

  const received = await new Promise((resolve) => {
    stream.once("data", (chunk) => resolve(chunk));
    channel.publish(
      buildLdapSyncEvent({
        type: "completed",
        run: { id: "run-10", status: "completed", startedAt: new Date(), triggeredByUserId: "user-7" }
      })
    );
  });

  assert.equal(received.event, "ldap.sync");
  const payload = JSON.parse(received.data);
  assert.equal(payload.type, "completed");
  assert.equal(payload.data.run.id, "run-10");

  stream.destroy();
});
