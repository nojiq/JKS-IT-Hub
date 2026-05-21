/* eslint-disable */
import "./bootstrap-database-env.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path, { dirname, join } from "node:path";
import fs from "node:fs/promises";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const Fastify = require("fastify");

import appPlugin from "../../apps/api/src/server.js";
import { getAuthConfig } from "../../apps/api/src/config/authConfig.js";
import { signSessionToken } from "../../apps/api/src/shared/auth/jwt.js";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_UPLOAD_DIR = join(__dirname, "../../apps/api/test-uploads-pm-evidence");

const buildMultipartBody = ({ fieldName = "evidence", file }) => {
    const boundary = `----it-hub-boundary-${randomUUID()}`;
    const chunks = [];

    if (file) {
        chunks.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${fieldName}"; filename="${file.filename}"\r\n` +
            `Content-Type: ${file.mimetype}\r\n\r\n`
        ));
        chunks.push(file.buffer);
        chunks.push(Buffer.from("\r\n"));
    }

    chunks.push(Buffer.from(`--${boundary}--\r\n`));

    return {
        boundary,
        payload: Buffer.concat(chunks)
    };
};

const authHeader = (config, token) => ({ cookie: `${config.cookie.name}=${token}` });

async function build() {
    const app = Fastify();
    await app.register(appPlugin);
    return app;
}

test("Maintenance run item evidence upload", async (t) => {
    const previousUploadDir = process.env.UPLOAD_DIR;
    process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;

    const config = getAuthConfig();
    const app = await build();
    const { uploadsConfig } = await import("../../apps/api/src/config/uploads.js");
    const activeUploadDir = path.isAbsolute(uploadsConfig.uploadDir)
        ? uploadsConfig.uploadDir
        : path.join(process.cwd(), uploadsConfig.uploadDir);

    let itUser;
    let assigneeUser;
    let otherUser;
    let itToken;
    let assigneeToken;
    let otherToken;
    let asset;
    let profile;
    let template;
    let assignment;
    let run;
    let runItem;
    let evidenceUrl;

    await t.test("setup", async () => {
        itUser = await prisma.user.create({
            data: { username: `pm-evidence-it-${randomUUID()}`, role: "it", status: "active" }
        });
        assigneeUser = await prisma.user.create({
            data: { username: `pm-evidence-assignee-${randomUUID()}`, role: "requester", status: "active" }
        });
        otherUser = await prisma.user.create({
            data: { username: `pm-evidence-other-${randomUUID()}`, role: "requester", status: "active" }
        });

        itToken = await signSessionToken({
            subject: itUser.id,
            payload: { username: itUser.username, role: itUser.role, status: itUser.status }
        }, config.jwt);
        assigneeToken = await signSessionToken({
            subject: assigneeUser.id,
            payload: { username: assigneeUser.username, role: assigneeUser.role, status: assigneeUser.status }
        }, config.jwt);
        otherToken = await signSessionToken({
            subject: otherUser.id,
            payload: { username: otherUser.username, role: otherUser.role, status: otherUser.status }
        }, config.jwt);

        asset = await prisma.asset.create({
            data: {
                snipeAssetId: Math.floor(Math.random() * 1000000000),
                assetTag: `PM-EVIDENCE-${randomUUID()}`,
                name: "Evidence upload test asset"
            }
        });
        profile = await prisma.maintenanceProfile.create({
            data: { name: `Evidence profile ${randomUUID()}`, intervalMonths: 3 }
        });
        template = await prisma.checklistTemplate.create({
            data: {
                profileId: profile.id,
                name: `Evidence checklist ${randomUUID()}`,
                version: 1
            }
        });
        assignment = await prisma.maintenanceAssignment.create({
            data: {
                profileId: profile.id,
                userId: assigneeUser.id,
                assetId: asset.id,
                status: "active",
                startDate: new Date(),
                activeKey: `${asset.id}:${profile.id}`
            }
        });
        run = await prisma.maintenanceRun.create({
            data: {
                assignmentId: assignment.id,
                profileId: profile.id,
                assetId: asset.id,
                userId: assigneeUser.id,
                checklistTemplateId: template.id,
                checklistVersion: 1,
                dueDate: new Date(),
                status: "in_progress"
            }
        });
        runItem = await prisma.maintenanceRunItem.create({
            data: {
                runId: run.id,
                sortOrder: 0,
                title: "Keyboard",
                required: true,
                evidenceRequired: false,
                status: "pending"
            }
        });
    });

    await t.test("assigned technician can upload evidence", async () => {
        const multipart = buildMultipartBody({
            file: {
                filename: "keyboard.png",
                mimetype: "image/png",
                buffer: Buffer.from("png evidence")
            }
        });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/runs/items/${runItem.id}/evidence`,
            headers: {
                ...authHeader(config, assigneeToken),
                "content-type": `multipart/form-data; boundary=${multipart.boundary}`
            },
            payload: multipart.payload
        });

        assert.equal(response.statusCode, 200, response.body);
        const body = JSON.parse(response.body).data;
        assert.match(body.evidenceUrl, /^\/api\/v1\/uploads\/pm-evidence-/);
        assert.equal(body.id, runItem.id);
        evidenceUrl = body.evidenceUrl;

        const saved = await prisma.maintenanceRunItem.findUnique({ where: { id: runItem.id } });
        assert.equal(saved.evidenceUrl, evidenceUrl);
    });

    await t.test("evidence file access is limited to assignee and IT", async () => {
        const assigneeRes = await app.inject({
            method: "GET",
            url: evidenceUrl,
            headers: authHeader(config, assigneeToken)
        });
        assert.equal(assigneeRes.statusCode, 200, assigneeRes.body);

        const itRes = await app.inject({
            method: "GET",
            url: evidenceUrl,
            headers: authHeader(config, itToken)
        });
        assert.equal(itRes.statusCode, 200, itRes.body);

        const otherRes = await app.inject({
            method: "GET",
            url: evidenceUrl,
            headers: authHeader(config, otherToken)
        });
        assert.equal(otherRes.statusCode, 403, otherRes.body);
    });

    await t.test("invalid evidence file type is rejected", async () => {
        const multipart = buildMultipartBody({
            file: {
                filename: "bad.txt",
                mimetype: "text/plain",
                buffer: Buffer.from("no")
            }
        });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/runs/items/${runItem.id}/evidence`,
            headers: {
                ...authHeader(config, assigneeToken),
                "content-type": `multipart/form-data; boundary=${multipart.boundary}`
            },
            payload: multipart.payload
        });
        assert.equal(response.statusCode, 400, response.body);
    });

    await t.test("oversized evidence file is rejected", async () => {
        const multipart = buildMultipartBody({
            file: {
                filename: "large.pdf",
                mimetype: "application/pdf",
                buffer: Buffer.alloc(5 * 1024 * 1024 + 1)
            }
        });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/runs/items/${runItem.id}/evidence`,
            headers: {
                ...authHeader(config, assigneeToken),
                "content-type": `multipart/form-data; boundary=${multipart.boundary}`
            },
            payload: multipart.payload
        });
        assert.equal(response.statusCode, 413, response.body);
    });

    await t.test("terminal run rejects evidence upload", async () => {
        await prisma.maintenanceRun.update({
            where: { id: run.id },
            data: { status: "completed", completedAt: new Date(), completedById: assigneeUser.id }
        });
        const multipart = buildMultipartBody({
            file: {
                filename: "done.pdf",
                mimetype: "application/pdf",
                buffer: Buffer.from("%PDF evidence")
            }
        });

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/maintenance/runs/items/${runItem.id}/evidence`,
            headers: {
                ...authHeader(config, assigneeToken),
                "content-type": `multipart/form-data; boundary=${multipart.boundary}`
            },
            payload: multipart.payload
        });
        assert.equal(response.statusCode, 409, response.body);
    });

    await t.test("cleanup", async () => {
        await prisma.maintenanceRunItem.deleteMany({ where: { runId: run?.id } }).catch(() => {});
        await prisma.maintenanceRun.deleteMany({ where: { id: run?.id } }).catch(() => {});
        await prisma.maintenanceAssignment.deleteMany({ where: { id: assignment?.id } }).catch(() => {});
        await prisma.maintenanceProfile.updateMany({ where: { id: profile?.id }, data: { activeTemplateId: null } }).catch(() => {});
        await prisma.checklistTemplate.deleteMany({ where: { id: template?.id } }).catch(() => {});
        await prisma.maintenanceProfile.deleteMany({ where: { id: profile?.id } }).catch(() => {});
        await prisma.asset.deleteMany({ where: { id: asset?.id } }).catch(() => {});
        await prisma.user.deleteMany({
            where: { id: { in: [itUser?.id, assigneeUser?.id, otherUser?.id].filter(Boolean) } }
        }).catch(() => {});
        await fs.rm(activeUploadDir, { recursive: true, force: true });

        if (previousUploadDir === undefined) {
            delete process.env.UPLOAD_DIR;
        } else {
            process.env.UPLOAD_DIR = previousUploadDir;
        }

        await prisma.$disconnect().catch(() => {});
        await app.close().catch(() => {});
    });
});
