import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

import { signSessionToken } from '../../apps/api/src/shared/auth/jwt.js';

// Keep Prisma module import-safe for route/service modules that depend on DB-bound repos.
process.env.DATABASE_URL ??= 'mysql://root:password@127.0.0.1:3306/it_hub_test';

const serviceModule = await import('../../apps/api/src/features/exports/service.js');
const { default: exportRoutes } = await import('../../apps/api/src/features/exports/routes.js');
const { createExportService, DisabledUserError } = serviceModule;

const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const Fastify = require('fastify');
const cookie = require('@fastify/cookie');

const baseConfig = {
  jwt: {
    secret: 'test-secret-test-secret',
    issuer: 'it-hub',
    audience: 'it-hub-web',
    expiresIn: '1h'
  },
  cookie: {
    name: 'it-hub-session',
    secure: true,
    sameSite: 'lax'
  }
};

const actorUser = {
  id: randomUUID(),
  username: 'test-it-user',
  role: 'it',
  status: 'active'
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

const createRouteTestApp = async ({ exportService }) => {
  const app = Fastify({ logger: false });
  await app.register(cookie);

  const userRepo = {
    findUserByUsername: async (username) => (username === actorUser.username ? actorUser : null),
    findUserById: async (id) => (id === actorUser.id ? actorUser : null)
  };

  await app.register(exportRoutes, {
    prefix: '/api/v1',
    config: baseConfig,
    userRepo,
    exportService
  });

  return app;
};

const exportDirs = [
  'apps/api/exports',
  'apps/api/temp',
  'apps/api/tmp',
  path.join(process.cwd(), 'apps/api/exports'),
  path.join(process.cwd(), 'exports'),
  '/tmp/it-hub-exports'
];

const snapshotDirectories = (dirs) => {
  const snapshot = {};
  for (const dir of dirs) {
    if (existsSync(dir)) {
      snapshot[dir] = readdirSync(dir);
    }
  }
  return snapshot;
};

const assertNoFilesystemArtifacts = (dirs, beforeFiles) => {
  for (const dir of dirs) {
    if (existsSync(dir)) {
      const afterFiles = readdirSync(dir);
      assert.deepEqual(
        afterFiles,
        beforeFiles[dir] || [],
        `File system artifacts found in ${dir} after export`
      );
    } else {
      assert.ok(!existsSync(dir), `New directory ${dir} created during export`);
    }
  }
};

const createNowMs = () => {
  let tick = 1000;
  return () => {
    tick += 25;
    return tick;
  };
};

describe('Export No Archiving Verification - Routes', () => {
  let app;
  let itSessionCookie;

  before(async () => {
    itSessionCookie = await createSessionCookie(actorUser);

    const mockExportService = {
      DisabledUserError,
      exportUserCredentials: async (userId) => `single-export-${userId}`,
      exportBatchCredentials: async () => [
        'IT-HUB BATCH CREDENTIAL EXPORT',
        'Batch ID: batch-test-001',
        'Total Users: 2'
      ].join('\n')
    };

    app = await createRouteTestApp({ exportService: mockExportService });
  });

  after(async () => {
    await app?.close();
  });

  it('should not create any export files on disk during single-user export', async () => {
    const beforeFiles = snapshotDirectories(exportDirs);
    const targetUserId = randomUUID();

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${targetUserId}/credentials/export`,
      headers: {
        cookie: itSessionCookie
      }
    });

    assert.strictEqual(response.statusCode, 200, 'Single-user export request should succeed');
    assert.strictEqual(response.payload, `single-export-${targetUserId}`);

    assert.ok(response.headers['cache-control']?.includes('no-store'));
    assert.strictEqual(response.headers['pragma'], 'no-cache');
    assert.strictEqual(response.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(response.headers.expires, '0');

    assertNoFilesystemArtifacts(exportDirs, beforeFiles);
  });

  it('should not create any export files on disk during batch export', async () => {
    const beforeFiles = snapshotDirectories(exportDirs);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/credentials/export/batch',
      headers: {
        cookie: itSessionCookie
      },
      payload: {
        userIds: [randomUUID(), randomUUID()],
        format: 'standard'
      }
    });

    assert.strictEqual(response.statusCode, 200, 'Batch export request should succeed');
    assert.ok(response.payload.includes('Batch ID: batch-test-001'));

    assert.ok(response.headers['cache-control']?.includes('no-store'));
    assert.strictEqual(response.headers['pragma'], 'no-cache');
    assert.strictEqual(response.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(response.headers.expires, '0');

    assertNoFilesystemArtifacts(exportDirs, beforeFiles);
  });
});

describe('Export No Archiving Verification - Audit Metadata', () => {
  it('should audit single-user export with metadata only (no credential content)', async () => {
    const targetUser = {
      id: randomUUID(),
      username: 'target-user',
      displayName: 'Target User',
      email: 'target@example.com',
      status: 'active'
    };

    const credential = {
      systemId: 'vpn',
      username: 'target-user',
      password: 'SuperSecretPassword!'
    };

    const auditEntries = [];
    const exportService = createExportService({
      credentialsRepo: {
        getUserById: async (userId) => (userId === targetUser.id ? targetUser : null),
        getUserCredentials: async () => [credential]
      },
      isUserDisabledFn: () => false,
      createAuditLogFn: async (entry) => {
        auditEntries.push(entry);
      },
      now: () => new Date('2026-02-10T12:00:00.000Z'),
      nowMs: createNowMs(),
      uuidFn: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    });

    await exportService.exportUserCredentials(targetUser.id, actorUser.id, 'standard');

    assert.strictEqual(auditEntries.length, 1);
    const [entry] = auditEntries;

    assert.strictEqual(entry.action, 'credentials.export.single_user');
    assert.strictEqual(entry.metadata.status, 'success');
    assert.strictEqual(entry.metadata.format, 'standard');

    const metadataStr = JSON.stringify(entry.metadata);
    assert.ok(!metadataStr.includes(credential.password), 'Audit metadata must not include password');
    assert.ok(!metadataStr.includes('exportContent'), 'Audit metadata must not include export content');
    assert.ok(!('password' in entry.metadata));
    assert.ok(!('usernames' in entry.metadata));
  });

  it('should audit batch export with status and without usernames/passwords', async () => {
    const exportedUser = {
      id: randomUUID(),
      username: 'active-user',
      displayName: 'Active User',
      email: 'active@example.com',
      status: 'active'
    };

    const skippedUser = {
      id: randomUUID(),
      username: 'disabled-user',
      displayName: 'Disabled User',
      email: 'disabled@example.com',
      status: 'disabled'
    };

    const credential = {
      systemConfig: { systemId: 'ad-main' },
      username: 'active-user',
      password: 'BatchSecretPassword!'
    };

    const usersById = new Map([
      [exportedUser.id, exportedUser],
      [skippedUser.id, skippedUser]
    ]);

    const auditEntries = [];
    const exportService = createExportService({
      credentialsRepo: {
        getUserById: async (userId) => usersById.get(userId) ?? null,
        getUserCredentials: async (userId) => (userId === exportedUser.id ? [credential] : [])
      },
      isUserDisabledFn: (user) => user.status === 'disabled',
      createAuditLogFn: async (entry) => {
        auditEntries.push(entry);
      },
      now: () => new Date('2026-02-10T12:30:00.000Z'),
      nowMs: createNowMs(),
      uuidFn: () => '12345678-1234-1234-1234-123456789abc'
    });

    const exportContent = await exportService.exportBatchCredentials(
      [exportedUser.id, skippedUser.id],
      actorUser.id,
      'standard'
    );

    assert.ok(exportContent.includes('IT-HUB BATCH CREDENTIAL EXPORT'));
    assert.strictEqual(auditEntries.length, 1);

    const [entry] = auditEntries;
    assert.strictEqual(entry.action, 'credentials.export.batch');
    assert.strictEqual(entry.metadata.status, 'partial_success');
    assert.strictEqual(entry.metadata.failedExports, 1);
    assert.strictEqual(entry.metadata.successfulExports, 1);

    const metadataStr = JSON.stringify(entry.metadata);
    assert.ok(!metadataStr.includes(credential.password), 'Audit metadata must not include password');
    assert.ok(!metadataStr.includes(credential.username), 'Audit metadata must not include credential username');
    assert.ok(!metadataStr.includes('exportContent'), 'Audit metadata must not include export content');
  });
});

describe('Export No Archiving Verification - Restart Behavior', () => {
  it('should not retain previously generated export content across service restarts', async () => {
    const targetUser = {
      id: randomUUID(),
      username: 'restart-user',
      displayName: 'Restart User',
      email: 'restart@example.com',
      status: 'active'
    };

    const credentialState = {
      password: 'initial-password'
    };

    const deps = {
      credentialsRepo: {
        getUserById: async () => targetUser,
        getUserCredentials: async () => [
          {
            systemId: 'vpn',
            username: 'restart-user',
            password: credentialState.password
          }
        ]
      },
      isUserDisabledFn: () => false,
      createAuditLogFn: async () => {},
      now: () => new Date('2026-02-10T13:00:00.000Z'),
      nowMs: createNowMs(),
      uuidFn: () => '99999999-1234-1234-1234-123456789abc'
    };

    const serviceBeforeRestart = createExportService(deps);
    const firstExport = await serviceBeforeRestart.exportUserCredentials(targetUser.id, actorUser.id, 'standard');

    credentialState.password = 'rotated-password';

    const serviceAfterRestart = createExportService(deps);
    const secondExport = await serviceAfterRestart.exportUserCredentials(targetUser.id, actorUser.id, 'standard');

    assert.ok(firstExport.includes('initial-password'));
    assert.ok(!firstExport.includes('rotated-password'));

    assert.ok(secondExport.includes('rotated-password'));
    assert.ok(!secondExport.includes('initial-password'));
  });
});
