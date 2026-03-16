/* eslint-disable */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));

import { prisma } from "../../apps/api/src/shared/db/prisma.js";
import {
    notifyUpcomingMaintenance,
    notifyOverdueMaintenance
} from "../../apps/api/src/features/notifications/maintenanceNotifications.js";
import { __setTransporter } from "../../apps/api/src/features/notifications/email/emailService.js";

const mockState = {
    shouldThrow: false
};

const mockTransporter = {
    sendMail: async () => {
        if (mockState.shouldThrow) {
            throw new Error("SMTP unavailable");
        }
        return { messageId: "mock-123" };
    }
};

before(async () => {
    process.env.SMTP_HOST = "mock.smtp.test";
    __setTransporter(mockTransporter);
});

after(async () => {
    await prisma.$disconnect();
});

test("Maintenance Notifications Integration", async (t) => {
    const cycle = await prisma.maintenanceCycleConfig.create({
        data: {
            name: `Test Cycle ${randomUUID()}`,
            intervalMonths: 3,
            isActive: true
        }
    });

    const tech = await prisma.user.create({
        data: {
            username: `tech-${randomUUID()}`,
            role: "it",
            status: "active",
            ldapAttributes: { mail: `tech-${randomUUID()}@example.com` }
        }
    });

    const duplicatedAdminEmail = `admin-dup-${randomUUID()}@example.com`;
    const adminPrimary = await prisma.user.create({
        data: {
            username: `admin-a-${randomUUID()}`,
            role: "head_it",
            status: "active",
            ldapAttributes: { mail: duplicatedAdminEmail }
        }
    });

    await prisma.user.create({
        data: {
            username: `admin-b-${randomUUID()}`,
            role: "admin",
            status: "active",
            ldapAttributes: { mail: duplicatedAdminEmail }
        }
    });

    await t.test("notifyUpcomingMaintenance creates notifications and audit metadata", async () => {
        const window = await prisma.maintenanceWindow.create({
            data: {
                cycleConfigId: cycle.id,
                scheduledStartDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                status: "UPCOMING",
                createdById: adminPrimary.id,
                assignedToId: tech.id
            },
            include: {
                cycleConfig: true,
                assignedTo: { select: { id: true, username: true, ldapAttributes: true } },
                deviceTypes: true
            }
        });

        await notifyUpcomingMaintenance(window);

        const updatedWindow = await prisma.maintenanceWindow.findUnique({
            where: { id: window.id }
        });
        assert.ok(updatedWindow.upcomingNotificationSentAt, "Should set upcoming notification timestamp");

        const inAppLog = await prisma.inAppNotification.findFirst({
            where: {
                referenceId: window.id,
                referenceType: "maintenance_window",
                userId: tech.id,
                type: "maintenance_upcoming"
            }
        });
        assert.ok(inAppLog, "Should create in-app notification record");

        const auditLog = await prisma.auditLog.findFirst({
            where: {
                action: "notification.maintenance.upcoming",
                entityId: window.id
            },
            orderBy: { createdAt: "desc" }
        });

        assert.ok(auditLog, "Should create upcoming audit log");
        assert.ok(["success", "partial"].includes(auditLog.metadata.deliveryStatus));
        assert.ok(auditLog.metadata.recipients);
    });

    await t.test("notifyOverdueMaintenance deduplicates escalation recipients and audits delivery status", async () => {
        mockState.shouldThrow = false;

        const window = await prisma.maintenanceWindow.create({
            data: {
                cycleConfigId: cycle.id,
                scheduledStartDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                status: "OVERDUE",
                createdById: adminPrimary.id,
                assignedToId: tech.id
            },
            include: {
                cycleConfig: true,
                assignedTo: { select: { id: true, username: true, ldapAttributes: true } },
                deviceTypes: true
            }
        });

        await notifyOverdueMaintenance(window);

        const updatedWindow = await prisma.maintenanceWindow.findUnique({
            where: { id: window.id }
        });
        assert.ok(updatedWindow.overdueNotificationSentAt, "Should set overdue notification timestamp");

        const escalationEmail = await prisma.emailNotification.findFirst({
            where: {
                referenceId: window.id,
                referenceType: "maintenance_window",
                templateType: "maintenance_overdue_escalation"
            }
        });
        assert.ok(escalationEmail, "Should create overdue escalation email record");

        const recipients = escalationEmail.recipientEmail
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
        assert.equal(new Set(recipients).size, recipients.length, "Escalation recipients should be deduplicated");
        assert.equal(
            recipients.filter((value) => value === duplicatedAdminEmail).length,
            1,
            "Duplicate admin email should be sent only once"
        );

        const auditLog = await prisma.auditLog.findFirst({
            where: {
                action: "notification.maintenance.overdue",
                entityId: window.id
            },
            orderBy: { createdAt: "desc" }
        });

        assert.ok(auditLog, "Should create overdue audit log");
        assert.ok(["success", "partial"].includes(auditLog.metadata.deliveryStatus));
        assert.equal(auditLog.metadata.escalatedToAdmins, true);
        assert.ok(auditLog.metadata.recipients?.email);
        assert.ok(auditLog.metadata.recipients?.inApp);
    });

    await t.test("notifyUpcomingMaintenance does not mark sent when no recipients exist", async () => {
        const window = await prisma.maintenanceWindow.create({
            data: {
                cycleConfigId: cycle.id,
                scheduledStartDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                status: "UPCOMING",
                createdById: adminPrimary.id
            },
            include: {
                cycleConfig: true,
                assignedTo: { select: { id: true, username: true, ldapAttributes: true } },
                deviceTypes: true
            }
        });

        await notifyUpcomingMaintenance(window);

        const updatedWindow = await prisma.maintenanceWindow.findUnique({
            where: { id: window.id }
        });
        assert.equal(updatedWindow.upcomingNotificationSentAt, null, "Should not set sent timestamp");

        const auditLog = await prisma.auditLog.findFirst({
            where: {
                action: "notification.maintenance.upcoming",
                entityId: window.id
            },
            orderBy: { createdAt: "desc" }
        });

        assert.ok(auditLog, "Should create audit log even when skipped");
        assert.equal(auditLog.metadata.deliveryStatus, "skipped");
    });
});
