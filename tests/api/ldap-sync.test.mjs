import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");
import ldapRoutes from "../../apps/api/src/features/ldap/routes.js";
import {
  createLdapSyncRunner,
  LdapSyncInProgressError,
  serializeSyncRun
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
    },
    getActiveSyncRun: async () => {
      return [...state]
        .filter((run) => run.status === "started")
        .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
    },
    listStartedSyncRuns: async () => {
      return [...state]
        .filter((run) => run.status === "started")
        .sort((a, b) => b.startedAt - a.startedAt);
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

test("GET /ldap/sync/latest recovers all stale started runs", async () => {
  const user = {
    id: "user-4b",
    username: "head-it",
    role: "head_it",
    status: "active"
  };
  const syncRepo = createInMemorySyncRepo([
    {
      id: "stale-older",
      status: "started",
      startedAt: new Date("2026-01-01T08:00:00Z"),
      completedAt: null,
      errorMessage: null,
      triggeredByUserId: null
    },
    {
      id: "stale-newer",
      status: "started",
      startedAt: new Date("2026-01-01T09:00:00Z"),
      completedAt: null,
      errorMessage: null,
      triggeredByUserId: null
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
  assert.equal(body.data.run.id, "stale-newer");
  assert.equal(body.data.run.status, "failed");

  const startedRuns = await syncRepo.listStartedSyncRuns();
  assert.equal(startedRuns.length, 0);

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

test("manual sync marks run failed when setup fails after row creation", async () => {
  const syncRepo = createInMemorySyncRepo();
  const userRepo = {
    ...createInMemoryUserRepo(),
    upsertUserFromLdap: async () => ({})
  };
  const runner = createLdapSyncRunner({
    config: baseConfig,
    ldapService: {
      searchEntries: async () => []
    },
    syncRepo,
    userRepo,
    auditRepo: {
      createAuditLog: async () => {
        throw new Error("Audit insert failed");
      }
    },
    eventChannel: null
  });

  await assert.rejects(
    () => runner.startManualSync({ actor: { id: "user-7" } }),
    /Audit insert failed/
  );

  const latest = await syncRepo.getLatestSyncRun();
  assert.equal(latest.status, "failed");
  assert.match(latest.errorMessage, /Audit insert failed/);
});

test("scheduled sync recovers all stale started runs before new run", async () => {
  const config = {
    ...baseConfig,
    ldapSync: {
      ...baseConfig.ldapSync,
      staleAfterMs: 60 * 1000
    }
  };
  const syncRepo = createInMemorySyncRepo([
    {
      id: "stale-1",
      status: "started",
      startedAt: new Date(Date.now() - 10 * 60 * 1000),
      completedAt: null,
      errorMessage: null,
      triggeredByUserId: null
    },
    {
      id: "stale-2",
      status: "started",
      startedAt: new Date(Date.now() - 5 * 60 * 1000),
      completedAt: null,
      errorMessage: null,
      triggeredByUserId: null
    }
  ]);
  const userRepo = {
    ...createInMemoryUserRepo(),
    upsertUserFromLdap: async () => ({})
  };
  const runner = createLdapSyncRunner({
    config,
    ldapService: {
      searchEntries: async () => []
    },
    syncRepo,
    userRepo,
    auditRepo: { createAuditLog: async () => ({}) },
    eventChannel: null
  });

  const latestRun = await runner.startScheduledSync();

  assert.equal(latestRun.status, "completed");
  const startedRuns = await syncRepo.listStartedSyncRuns();
  assert.equal(startedRuns.length, 0);

  const latest = await syncRepo.getLatestSyncRun();
  assert.notEqual(latest.id, "stale-1");
  assert.notEqual(latest.id, "stale-2");
});

test("manual sync serializes concurrent starts with sync start lock", async () => {
  const state = [];
  let nextId = 1;
  let lockTail = Promise.resolve();
  const syncRepo = {
    withSyncStartLock: async (fn) => {
      const previous = lockTail;
      let release;
      lockTail = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await fn(syncRepo);
      } finally {
        release();
      }
    },
    getActiveSyncRun: async () => {
      return [...state].find((run) => run.status === "started") ?? null;
    },
    getLatestSyncRun: async () => {
      return state.at(-1) ?? null;
    },
    createSyncRun: async (data) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      const run = {
        id: data.id ?? `run-${nextId++}`,
        status: data.status ?? "started",
        startedAt: data.startedAt ?? new Date(),
        completedAt: data.completedAt ?? null,
        processedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        errorMessage: null,
        triggeredByUserId: data.triggeredByUserId
      };
      state.push(run);
      return run;
    },
    updateSyncRun: async (id, updates) => {
      const index = state.findIndex((run) => run.id === id);
      state[index] = { ...state[index], ...updates };
      return state[index];
    },
    listStartedSyncRuns: async () => {
      return state.filter((run) => run.status === "started");
    }
  };
  const runner = createLdapSyncRunner({
    config: baseConfig,
    ldapService: {
      searchEntries: async () => new Promise(() => {})
    },
    syncRepo,
    userRepo: {
      ...createInMemoryUserRepo(),
      upsertUserFromLdap: async () => ({})
    },
    auditRepo: { createAuditLog: async () => ({}) },
    eventChannel: null
  });

  const [first, second] = await Promise.allSettled([
    runner.startManualSync({ actor: { id: "user-8" } }),
    runner.startManualSync({ actor: { id: "user-9" } })
  ]);

  assert.equal(first.status, "fulfilled");
  assert.equal(second.status, "rejected");
  assert.equal(second.reason?.name, "LdapSyncInProgressError");
  assert.equal(state.length, 1);
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

test("manual sync writes audit rows for newly created LDAP users", async () => {
  const auditEntries = [];
  const syncRepo = createInMemorySyncRepo();
  const runner = createLdapSyncRunner({
    config: baseConfig,
    ldapService: {
      searchEntries: async () => [
        {
          dn: "uid=newuser,dc=example,dc=com",
          uid: "newuser",
          cn: "New User",
          mail: "new@example.com"
        }
      ]
    },
    syncRepo,
    userRepo: {
      findUsersByUsernames: async () => [],
      upsertUserFromLdap: async (data) => ({
        id: "created-user-1",
        username: data.username,
        ldapDn: data.ldapDn
      })
    },
    auditRepo: {
      createAuditLog: async (entry) => {
        auditEntries.push(entry);
        return entry;
      }
    },
    eventChannel: null
  });

  const run = await runner.startScheduledSync();

  assert.equal(run.createdCount, 1);
  const createdAudit = auditEntries.find((entry) => entry.action === "user.ldap_create");
  assert.ok(createdAudit, "expected user.ldap_create audit entry");
  assert.equal(createdAudit.actorUserId, null);
  assert.equal(createdAudit.entityType, "user");
  assert.equal(createdAudit.entityId, "created-user-1");
  assert.equal(createdAudit.metadata.username, "newuser");
  assert.equal(createdAudit.metadata.ldapDn, "uid=newuser,dc=example,dc=com");
  assert.equal(createdAudit.metadata.syncRunId, run.id);
});

test("scheduled sync enriches LDAP users with Pulse org snapshot", async () => {
  const syncRepo = createInMemorySyncRepo();
  const upserts = [];
  const pulseCalls = [];
  const orgSnapshot = {
    source: "jkspulse",
    division: { id: "div-1", name: "CORPORATE SERVICES" },
    department: { id: "dept-1", code: "IT", name: "IT" },
    section: { id: "sec-1", name: "INFRASTRUCTURE" },
    matchedBy: "email",
    confidence: "exact"
  };
  const runner = createLdapSyncRunner({
    config: baseConfig,
    ldapService: {
      searchEntries: async () => [
        {
          dn: "uid=jane,dc=example,dc=com",
          uid: "jane",
          cn: "Jane Doe",
          mail: "jane@jks.com"
        }
      ]
    },
    syncRepo,
    userRepo: {
      findUsersByUsernames: async () => [],
      upsertUserFromLdap: async (data) => {
        upserts.push(data);
        return { id: "user-1", username: data.username };
      }
    },
    pulseOrgClient: {
      resolveForLdapUser: async (input) => {
        pulseCalls.push(input);
        return orgSnapshot;
      }
    },
    auditRepo: { createAuditLog: async () => ({}) },
    eventChannel: null
  });

  const run = await runner.startScheduledSync();

  assert.equal(run.status, "completed");
  assert.equal(pulseCalls.length, 1);
  assert.equal(pulseCalls[0].username, "jane");
  assert.equal(pulseCalls[0].ldapAttributes.mail, "jane@jks.com");
  assert.deepEqual(upserts[0].orgSnapshot, orgSnapshot);
  assert.ok(upserts[0].orgSyncedAt instanceof Date);
});

test("scheduled sync assigns new IT department users as technicians", async () => {
  const syncRepo = createInMemorySyncRepo();
  const upserts = [];
  const runner = createLdapSyncRunner({
    config: {
      ...baseConfig,
      ldapSync: {
        ...baseConfig.ldapSync,
        attributes: ["uid", "cn", "mail", "department"]
      }
    },
    ldapService: {
      searchEntries: async () => [
        {
          dn: "uid=ituser,dc=example,dc=com",
          uid: "ituser",
          cn: "IT User",
          mail: "ituser@example.com",
          department: "IT"
        }
      ]
    },
    syncRepo,
    userRepo: {
      findUsersByUsernames: async () => [],
      upsertUserFromLdap: async (data) => {
        upserts.push(data);
        return { id: "user-1", username: data.username, role: data.role };
      }
    },
    auditRepo: { createAuditLog: async () => ({}) },
    eventChannel: null
  });

  const run = await runner.startScheduledSync();

  assert.equal(run.status, "completed");
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].role, "it");
});

test("scheduled sync updates unchanged LDAP user when Pulse org snapshot changed", async () => {
  const syncRepo = createInMemorySyncRepo();
  const upserts = [];
  const nextOrgSnapshot = {
    source: "jkspulse",
    division: { id: "div-1", name: "CORPORATE SERVICES" },
    department: { id: "dept-1", code: "IT", name: "IT" },
    section: null,
    matchedBy: "department",
    confidence: "exact"
  };
  const runner = createLdapSyncRunner({
    config: baseConfig,
    ldapService: {
      searchEntries: async () => [
        {
          dn: "uid=jane,dc=example,dc=com",
          uid: "jane",
          cn: "Jane Doe",
          mail: "jane@jks.com"
        }
      ]
    },
    syncRepo,
    userRepo: {
      findUsersByUsernames: async () => [
        {
          id: "user-1",
          username: "jane",
          ldapAttributes: { uid: "jane", cn: "Jane Doe", mail: "jane@jks.com" },
          orgSnapshot: { source: "jkspulse", department: { id: "old", name: "OLD" } }
        }
      ],
      upsertUserFromLdap: async (data) => {
        upserts.push(data);
        return { id: "user-1", username: data.username };
      }
    },
    pulseOrgClient: {
      resolveForLdapUser: async () => nextOrgSnapshot
    },
    auditRepo: { createAuditLog: async () => ({}) },
    eventChannel: null
  });

  const run = await runner.startScheduledSync();

  assert.equal(run.updatedCount, 1);
  assert.equal(upserts.length, 1);
  assert.deepEqual(upserts[0].orgSnapshot, nextOrgSnapshot);
});

test("scheduled sync continues when Pulse org enrichment fails", async () => {
  const syncRepo = createInMemorySyncRepo();
  const upserts = [];
  const runner = createLdapSyncRunner({
    config: baseConfig,
    ldapService: {
      searchEntries: async () => [
        {
          dn: "uid=jane,dc=example,dc=com",
          uid: "jane",
          cn: "Jane Doe",
          mail: "jane@jks.com"
        }
      ]
    },
    syncRepo,
    userRepo: {
      findUsersByUsernames: async () => [],
      upsertUserFromLdap: async (data) => {
        upserts.push(data);
        return { id: "user-1", username: data.username };
      }
    },
    pulseOrgClient: {
      resolveForLdapUser: async () => {
        throw new Error("Pulse unavailable");
      }
    },
    auditRepo: { createAuditLog: async () => ({}) },
    eventChannel: null
  });

  const run = await runner.startScheduledSync();

  assert.equal(run.status, "completed");
  assert.equal(upserts.length, 1);
  assert.equal("orgSnapshot" in upserts[0], false);
});

test("serializeSyncRun includes compact created user summary", () => {
  const payload = serializeSyncRun({
    id: "run-1",
    status: "completed",
    startedAt: new Date("2026-05-11T00:00:00.000Z"),
    completedAt: new Date("2026-05-11T00:00:01.000Z"),
    processedCount: 3,
    createdCount: 2,
    updatedCount: 0,
    skippedCount: 1,
    errorMessage: null,
    triggeredByUserId: null,
    createdUsers: [
      { id: "u1", username: "ali" },
      { id: "u2", username: "sara" }
    ],
    createdUsersHasMore: false
  });

  assert.deepEqual(payload.createdUsers, [
    { id: "u1", username: "ali" },
    { id: "u2", username: "sara" }
  ]);
  assert.equal(payload.createdUsersHasMore, false);
});
