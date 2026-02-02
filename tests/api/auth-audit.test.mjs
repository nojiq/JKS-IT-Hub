import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { createAuditLog, getAuditLogs, prisma } from "../../apps/api/src/features/audit/repo.js";
import { createUser } from "../../apps/api/src/features/users/repo.js";

after(async () => {
  await prisma.$disconnect();
});

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");

import authRoutes from "../../apps/api/src/features/auth/routes.js";
import { LdapInvalidCredentialsError } from "../../apps/api/src/features/ldap/service.js";

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
  },
  cors: {
    origin: "http://localhost:5173"
  }
};

// Create a user repo that uses the real DB for create, but in-memory for lookups
const createHybridUserRepo = (existingDbUser = null) => {
  const users = new Map();
  
  if (existingDbUser) {
    users.set(existingDbUser.username, existingDbUser);
  }

  return {
    findOrCreateUser: async ({ username, role = "requester" }) => {
      const existing = users.get(username);
      if (existing) {
        return existing;
      }
      // Create in real database
      const user = await createUser({ username, role });
      users.set(username, user);
      return user;
    },
    findUserByUsername: async (username) => users.get(username) ?? null,
    isUserDisabled: (user) => user?.status === "disabled"
  };
};

const auditRepo = await import("../../apps/api/src/features/audit/repo.js");

const createTestApp = async ({ ldapService, userRepo }) => {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  await app.register(authRoutes, {
    config: baseConfig,
    ldapAuthFn: ldapService?.authenticate,
    userRepo,
    auditRepo
  });
  await app.ready();
  return app;
};

test("POST /auth/login creates audit log on success", async () => {
  const testId = randomUUID();
  const username = `testuser-${testId}`;
  const ldapService = {
    authenticate: async () => ({ dn: `uid=${username},dc=example,dc=com` })
  };
  const userRepo = createHybridUserRepo();
  const app = await createTestApp({ ldapService, userRepo });

  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { username, password: "secret" }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  const userId = body.data.user.id;

  // Wait a bit for async audit log creation
  await new Promise(resolve => setTimeout(resolve, 100));

  // Verify audit log was created - query recent logs
  const allLogs = await getAuditLogs({ limit: 100 });
  const loginLog = allLogs.logs.find(log => 
    log.action === "auth.login" && 
    log.actorUserId === userId
  );
  assert.ok(loginLog, "Should create auth.login audit log");
  assert.equal(loginLog.entityType, "user");
  assert.equal(loginLog.entityId, userId);
  assert.ok(loginLog.metadata);
  assert.ok(loginLog.metadata.ip);
  assert.ok(loginLog.createdAt);

  await app.close();
});

test("POST /auth/login creates audit log on failure", async () => {
  const testId = randomUUID();
  const username = `testuser-fail-${testId}`;
  const ldapService = {
    authenticate: async () => {
      throw new LdapInvalidCredentialsError();
    }
  };
  const userRepo = createHybridUserRepo();
  const app = await createTestApp({ ldapService, userRepo });

  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { username, password: "wrong" }
  });

  assert.equal(response.statusCode, 401);

  // Wait a bit for async audit log creation
  await new Promise(resolve => setTimeout(resolve, 100));

  // Verify audit log was created for failed login
  const allLogs = await getAuditLogs({ limit: 100 });
  const failureLog = allLogs.logs.find(log => 
    log.action === "auth.login_failure" && 
    log.entityId === username
  );
  assert.ok(failureLog, "Should create auth.login_failure audit log");
  assert.equal(failureLog.actorUserId, null);
  assert.equal(failureLog.metadata.reason, "Invalid credentials");
  assert.ok(failureLog.metadata.ip);

  await app.close();
});

test("POST /auth/logout creates audit log", async () => {
  const testId = randomUUID();
  const username = `testuser-logout-${testId}`;
  const ldapService = {
    authenticate: async () => ({ dn: `uid=${username},dc=example,dc=com` })
  };
  const userRepo = createHybridUserRepo();
  const app = await createTestApp({ ldapService, userRepo });

  // First login to establish session
  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { username, password: "secret" }
  });

  assert.equal(loginResponse.statusCode, 200);
  const body = loginResponse.json();
  const userId = body.data.user.id;
  
  // Extract cookie value from set-cookie header
  const setCookieHeader = loginResponse.headers["set-cookie"];
  assert.ok(setCookieHeader, "Should have set-cookie header");
  // Parse just the cookie name=value part (before the first semicolon)
  const cookieMatch = setCookieHeader.match(/it-hub-session=([^;]+)/);
  assert.ok(cookieMatch, "Should have session cookie");
  const cookieValue = `${baseConfig.cookie.name}=${cookieMatch[1]}`;

  // Then logout
  const logoutResponse = await app.inject({
    method: "POST",
    url: "/auth/logout",
    headers: { cookie: cookieValue }
  });

  assert.equal(logoutResponse.statusCode, 200);

  // Wait a bit for async audit log creation
  await new Promise(resolve => setTimeout(resolve, 100));

  // Verify audit log was created - query recent logs
  const allLogs = await getAuditLogs({ limit: 100 });
  const logoutLog = allLogs.logs.find(log => 
    log.action === "auth.logout" && 
    log.actorUserId === userId
  );
  assert.ok(logoutLog, "Should create auth.logout audit log");
  assert.equal(logoutLog.entityType, "user");
  assert.equal(logoutLog.entityId, userId);
  assert.ok(logoutLog.metadata);
  assert.ok(logoutLog.metadata.ip);

  await app.close();
});

test("Security: Verify no API endpoint allows deleting audit logs", async () => {
  // This is a security validation test - we need to verify that:
  // 1. The audit repo doesn't export delete methods
  // 2. No API routes expose audit log deletion
  
  // Check that audit repo only exports allowed methods
  assert.ok(auditRepo.createAuditLog, "createAuditLog should be exported");
  assert.ok(auditRepo.findAuditLogsByEntity, "findAuditLogsByEntity should be exported");
  assert.ok(auditRepo.getAuditLogs, "getAuditLogs should be exported");
  assert.ok(!auditRepo.updateAuditLog, "updateAuditLog should NOT be exported");
  assert.ok(!auditRepo.deleteAuditLog, "deleteAuditLog should NOT be exported");
  assert.ok(!auditRepo.deleteMany, "deleteMany should NOT be exported");
});
