
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";
import { createUser } from "../../apps/api/src/features/users/repo.js";
import { createTemplate } from "../../apps/api/src/features/credentials/service.js"; // Service call
import * as credentialService from "../../apps/api/src/features/credentials/service.js";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";
import credentialRoutes from "../../apps/api/src/features/credentials/routes.js";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");
const cookie = require("@fastify/cookie");

const baseConfig = {
    jwt: {
        secret: "test-secret",
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

const createSessionCookie = async (user) => {
    const token = await signSessionToken(
        {
            subject: user.id,
            payload: { username: user.username, role: user.role, status: user.status }
        },
        baseConfig.jwt
    );
    return `${baseConfig.cookie.name}=${token}`;
};

const createTestApp = async ({ userRepo, credentialService, auditRepo } = {}) => {
    const app = Fastify({ logger: false });
    await app.register(cookie);

    await app.register(credentialRoutes, {
        prefix: "/api/v1/credentials",
        config: baseConfig,
        userRepo,
        credentialService,
        auditRepo
    });

    await app.ready();
    return app;
};

after(async () => {
    await prisma.$disconnect();
});

test("Locked credential prevents regeneration", async () => {
    const suffix = randomUUID().substring(0, 8);
    // Clean DB
    await prisma.lockedCredential.deleteMany({});
    await prisma.credentialVersion.deleteMany({});
    await prisma.userCredential.deleteMany({});
    await prisma.credentialTemplate.deleteMany({}); // Added
    await prisma.systemConfig.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.auditLog.deleteMany({});

    // 1. Setup Actor
    const admin = await createUser({ username: `admin-${suffix}`, role: "it" });
    const user = await createUser({
        username: `user-${suffix}`,
        role: "requester",
        ldapAttributes: {
            givenName: "John",
            sn: "Doe",
            mail: "john.doe@example.com",
            department: "IT"
        }
    });

    // 2. Setup System Configs (Required for FK)
    const sysEmail = await prisma.systemConfig.create({ data: { systemId: "email", usernameLdapField: "mail" } });
    process.stderr.write(`Created SystemConfig email: ${JSON.stringify(sysEmail)}\n`);
    const sysVpn = await prisma.systemConfig.create({ data: { systemId: "vpn", usernameLdapField: "sAMAccountName" } });
    process.stderr.write(`Created SystemConfig vpn: ${JSON.stringify(sysVpn)}\n`);

    // 2b. Setup Template
    const template = await createTemplate(admin.id, {
        name: `Template ${suffix}`,
        structure: {
            systems: ["email", "vpn"],
            fields: [{ name: "username", type: "generated" }, { name: "password", type: "generated" }]
        }
    });

    // Verify config existence
    const configCount = await prisma.systemConfig.count();
    console.log("SystemConfig count:", configCount);

    // 3. Generate initial credentials (service call directly for speed)
    await credentialService.generateUserCredentials(admin.id, user.id);

    // Verify generation
    const creds = await credentialService.listUserCredentials(user.id);
    assert.equal(creds.length, 2);
    const emailCred = creds.find(c => c.systemId === "email");
    const vpnCred = creds.find(c => c.systemId === "vpn");

    // 4. Lock email credential
    await credentialService.lockCredential(user.id, "email", "Policy Check", admin.id);
    const lockStatus = await credentialService.isCredentialLocked(user.id, "email");
    assert.equal(lockStatus, true);

    const lockAudit = await prisma.auditLog.findFirst({
        where: { action: "credential.lock", entityId: emailCred.id }
    });
    assert.ok(lockAudit, "Lock action should be audit logged");

    // 5. Update User (Change LDPA) to force regeneration
    await prisma.user.update({
        where: { id: user.id },
        data: {
            ldapAttributes: {
                givenName: "Jonathan", // Changed name
                sn: "Doe",
                mail: "john.doe@example.com",
                department: "IT"
            }
        }
    });

    // 5b. Update Template (Bump version) to force regeneration (Since we lack ldapSources)
    await credentialService.updateTemplate(admin.id, template.id, {
        name: `Template ${suffix} V2`
    });

    // 6. Preview Regeneration
    // Mock user repo to return updated user
    // Actually we are using real DB, so repo checks DB.
    // We need to pass the REAL repo to `createTestApp` or rely on `credentialRoutes` importing it?
    // In strict unit test logic, `credentialRoutes` imports `repo` if we don't pass `userRepo`. 
    // But `routes.js` accepts `userRepo` dependency.
    // We should pass the real user repo wrapper or rely on imports.
    // The `credentialService` we pass to `createTestApp` IS THE REAL ONE from imports.
    // `credentialService.js` uses `repo.js` which uses `prisma`.
    // So it should work with real DB.

    const userRepo = await import("../../apps/api/src/features/users/repo.js");
    const auditRepo = await import("../../apps/api/src/features/audit/repo.js");

    const app = await createTestApp({
        userRepo,
        credentialService,
        auditRepo
    });

    const previewResponse = await app.inject({
        method: "POST",
        url: `/api/v1/credentials/users/${user.id}/regenerate`, // Correct route
        headers: { cookie: await createSessionCookie(admin) }
    });

    if (previewResponse.statusCode !== 200) {
        console.log("Preview failed. Response:", previewResponse.body);
    }
    assert.equal(previewResponse.statusCode, 200, "Preview should succeed");
    const preview = previewResponse.json().data;

    // 7. Verify Skipped
    const emailComparison = preview.comparisons.find(c => c.system === "email");
    const vpnComparison = preview.comparisons.find(c => c.system === "vpn");

    assert.equal(emailComparison.skipped, true, "Email should be skipped (locked)");
    assert.equal(emailComparison.skipReason, "credential_locked");

    assert.equal(vpnComparison.skipped, false, "VPN should NOT be skipped");

    // 8. Confirm Regeneration without skip should be blocked
    const blockedResponse = await app.inject({
        method: "POST",
        url: `/api/v1/credentials/users/${user.id}/regenerate/confirm`,
        headers: { cookie: await createSessionCookie(admin) },
        payload: {
            previewToken: preview.previewToken,
            confirmed: true
        }
    });

    assert.equal(blockedResponse.statusCode, 422);
    assert.equal(blockedResponse.json().type, "/problems/credentials-locked");

    // 9. Confirm Regeneration with skip locked
    const confirmResponse = await app.inject({
        method: "POST",
        url: `/api/v1/credentials/users/${user.id}/regenerate/confirm`,
        headers: { cookie: await createSessionCookie(admin) },
        payload: {
            previewToken: preview.previewToken,
            confirmed: true,
            skipLocked: true
        }
    });

    assert.equal(confirmResponse.statusCode, 201);
    const result = confirmResponse.json().data;

    // 10. Verify result
    // Skipped list
    assert.ok(result.skippedCredentials.find(s => s.system === "email"));
    // Regenerated list
    assert.ok(result.regeneratedCredentials.find(r => r.system === "vpn"));
    assert.ok(!result.regeneratedCredentials.find(r => r.system === "email"));

    // 11. Verify DB state
    const newCreds = await credentialService.listUserCredentials(user.id);
    const newEmail = newCreds.find(c => c.system === "email");
    const newVpn = newCreds.find(c => c.system === "vpn");

    // Email should match old (username didn't update)
    // Actually, generator might have generated new username "jonathan.doe"
    // But since skipped, DB should still have "john.doe" (or whatever was generated first)
    // We can check version or ID.
    assert.equal(newEmail.id, emailCred.id, "Email credential ID should not change");

    // VPN credential ID should change (regenerated = new record)
    assert.notEqual(newVpn.id, vpnCred.id, "VPN credential ID should change");

    // 12. Unlock and verify audit log
    await credentialService.unlockCredential(user.id, "email", admin.id);
    const unlockAudit = await prisma.auditLog.findFirst({
        where: { action: "credential.unlock", entityId: `${user.id}:email` }
    });
    assert.ok(unlockAudit, "Unlock action should be audit logged");
});
