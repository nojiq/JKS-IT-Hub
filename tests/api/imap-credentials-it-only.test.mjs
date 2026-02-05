
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
let itUser;
let nonItUser;
let itToken;
let nonItToken;
let config;

before(async () => {
    config = getAuthConfig();
    app = await build();

    // Create IT User
    itUser = await prisma.user.create({
        data: {
            username: `it-user-${randomUUID()}`,
            role: "it",
            status: "active"
        }
    });

    // Create Non-IT User
    nonItUser = await prisma.user.create({
        data: {
            username: `requester-${randomUUID()}`,
            role: "requester",
            status: "active"
        }
    });

    // Generate Tokens
    itToken = await signSessionToken({
        subject: itUser.id,
        payload: {
            username: itUser.username,
            role: itUser.role
        }
    }, config.jwt);

    nonItToken = await signSessionToken({
        subject: nonItUser.id,
        payload: {
            username: nonItUser.username,
            role: nonItUser.role
        }
    }, config.jwt);
});

after(async () => {
    await prisma.$disconnect();
    await app.close();
});

test("IMAP Credentials - IT-Only Access", async (t) => {

    await t.test("Task 1: System Config accepts isItOnly flag", async () => {
        const systemId = `imap-test-${randomUUID()}`;

        // This should initially fail/error until schema is updated
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/system-configs",
            headers: { cookie: `it-hub-session=${itToken}` },
            payload: {
                systemId: systemId,
                usernameLdapField: "mail",
                description: "IMAP IT Only System",
                isItOnly: true
            }
        });

        // Until implemented, this might fail with 400 (validation) or 500 (db error)
        // or 200 but ignore the field.
        // We expect it to properly store isItOnly = true
        if (response.statusCode === 201) {
            const body = JSON.parse(response.body);
            assert.equal(body.data.isItOnly, true, "isItOnly should be true in response");

            // Verify in DB
            const dbRecord = await prisma.systemConfig.findUnique({
                where: { systemId }
            });
            assert.equal(dbRecord.isItOnly, true, "isItOnly should be true in DB");
        } else {
            // If validation fails as expected before implementation
            assert.fail(`Response status ${response.statusCode}: ${response.body}`);
            // For now we accept failure as "Red" state
        }
    });



    await t.test("Task 3-5: Credential filtering based on IT role", async () => {
        // Setup: Ensure systems and credentials exist
        const normalSystemId = `ad-${randomUUID()}`;
        const imapSystemId = `imap-${randomUUID()}`; // Use a unique one for isolation

        // Create Normal System
        await prisma.systemConfig.create({
            data: {
                systemId: normalSystemId,
                usernameLdapField: "sAMAccountName",
                description: "Normal System",
                isItOnly: false
            }
        });

        // Create IMAP System (IT Only)
        await prisma.systemConfig.create({
            data: {
                systemId: imapSystemId,
                usernameLdapField: "mail",
                description: "IMAP System",
                isItOnly: true
            }
        });

        // Target user (can be anyone, let's use non-IT user as target)
        const targetUser = nonItUser;

        // Create Credentials for Target User
        await prisma.userCredential.create({
            data: {
                userId: targetUser.id,
                systemId: normalSystemId,
                username: "jdoe",
                password: "encrypted-pass",
                isActive: true,
                templateVersion: 1,
                generatedBy: itUser.id
            }
        });

        await prisma.userCredential.create({
            data: {
                userId: targetUser.id,
                systemId: imapSystemId,
                username: "jdoe@email.com",
                password: "encrypted-pass",
                isActive: true,
                templateVersion: 1,
                generatedBy: itUser.id
            }
        });

        // 1. Test Non-IT User (Requester) -> GET credentials
        // Should only see Normal credential
        const responseNonIt = await app.inject({
            method: "GET",
            url: `/api/v1/credentials/users/${targetUser.id}`,
            headers: { cookie: `it-hub-session=${nonItToken}` } // Requester viewing own credentials? 
            // Wait, usually users can see their own credentials?
            // Story says: "IMAP credentials stored as IT-only... As IT staff... So that sensitive access remains restricted."
            // AC1: "When a non-IT user (Requester...) attempts to view them -> access is denied... invisible in UI"
            // This clearly implies even the OWNER cannot see the IMAP password?
            // "IMAP credentials provide email access... never exposed to non-IT users"
            // Yes, strict IT-only.
        });

        // Note: If Non-IT user views OTHER user credentials, they might be blocked entirely (RBAC).
        // But if they view THEIR OWN (requester self-service), they normally can seeing their credentials?
        // Logic: `/users/:id/credentials` usually allows self-view.
        // If Non-IT user is viewing self, they should NOT see IMAP.

        if (responseNonIt.statusCode === 200) {
            const body = JSON.parse(responseNonIt.body);
            const credentials = body.data;

            const hasNormal = credentials.some(c => c.systemId === normalSystemId);
            const hasImap = credentials.some(c => c.systemId === imapSystemId);

            assert.equal(hasNormal, true, "Should see normal credential");
            assert.equal(hasImap, false, "Should NOT see IMAP credential");
        } else {
            // If RBAC blocks access entirely, that might be another issue, but let's assume allowed for self.
            // If not allowed, we need to check permissions.
            // Assuming self-access is allowed.
            assert.equal(responseNonIt.statusCode, 200, `Non-IT should access own credentials. Status: ${responseNonIt.statusCode} Body: ${responseNonIt.body}`);
        }

        // 2. Test IT User -> GET credentials
        // Should see BOTH
        const responseIt = await app.inject({
            method: "GET",
            url: `/api/v1/credentials/users/${targetUser.id}`,
            headers: { cookie: `it-hub-session=${itToken}` }
        });

        assert.equal(responseIt.statusCode, 200, "IT user should access credentials");
        const bodyIt = JSON.parse(responseIt.body);
        const credentialsIt = bodyIt.data;

        const hasNormalIt = credentialsIt.some(c => c.systemId === normalSystemId);
        const hasImapIt = credentialsIt.some(c => c.systemId === imapSystemId);

        assert.equal(hasNormalIt, true, "IT should see normal credential");
        assert.equal(hasImapIt, true, "IT should see IMAP credential");
    });
});
