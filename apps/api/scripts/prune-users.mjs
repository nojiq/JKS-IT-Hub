#!/usr/bin/env node
/**
 * Prune users from the local DB to enable a "fresh" LDAP sync.
 *
 * Default behavior is dry-run. Use --apply to perform changes.
 *
 * Examples (from repo root):
 *   node --env-file=.env apps/api/scripts/prune-users.mjs --keep haziq.afendi --apply
 *   node --env-file=.env apps/api/scripts/prune-users.mjs --keep haziq.afendi
 */

import { prisma } from "../src/shared/db/prisma.js";

const argValue = (name) => {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("--")) return null;
  return next;
};

const hasArg = (name) => process.argv.includes(name);

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const KEEP_USERNAME = argValue("--keep") || "haziq.afendi";
const APPLY = hasArg("--apply");

const logStep = (msg) => console.log(`- ${msg}`);

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Run with: node --env-file=.env apps/api/scripts/prune-users.mjs ...");
  }

  const keepUser = await prisma.user.findUnique({
    where: { username: KEEP_USERNAME },
    select: { id: true, username: true, role: true, status: true }
  });

  if (!keepUser) {
    throw new Error(`Keep user not found: username=${KEEP_USERNAME}`);
  }

  const deleteUsers = await prisma.user.findMany({
    where: { username: { not: KEEP_USERNAME } },
    select: { id: true, username: true }
  });

  const deleteIds = deleteUsers.map((u) => u.id);

  console.log(JSON.stringify({
    mode: APPLY ? "apply" : "dry-run",
    keep: keepUser,
    deleteUserCount: deleteUsers.length,
    deleteUserSample: deleteUsers.slice(0, 10).map((u) => u.username)
  }, null, 2));

  if (!deleteIds.length) {
    logStep("No users to delete.");
    return;
  }

  // Precompute maintenance windows/completions that would block user deletion.
  const windowsToDelete = await prisma.maintenanceWindow.findMany({
    where: { createdById: { in: deleteIds } },
    select: { id: true }
  });
  const windowIdsToDelete = windowsToDelete.map((w) => w.id);

  const completionsForWindows = windowIdsToDelete.length
    ? await prisma.maintenanceCompletion.findMany({
        where: { windowId: { in: windowIdsToDelete } },
        select: { id: true }
      })
    : [];
  const completionIdsForWindows = completionsForWindows.map((c) => c.id);

  const stats = {
    auditLogs: await prisma.auditLog.count({ where: { actorUserId: { in: deleteIds } } }),
    inAppNotifications: await prisma.inAppNotification.count({ where: { userId: { in: deleteIds } } }),
    emailNotificationsToNull: await prisma.emailNotification.count({ where: { recipientUserId: { in: deleteIds } } }),
    ldapSyncRunsToNull: await prisma.ldapSyncRun.count({ where: { triggeredByUserId: { in: deleteIds } } }),
    itemRequestsToDelete: await prisma.itemRequest.count({ where: { requesterId: { in: deleteIds } } }),
    itemRequestsToNullReviewedBy: await prisma.itemRequest.count({ where: { itReviewedById: { in: deleteIds } } }),
    itemRequestsToNullApprovedBy: await prisma.itemRequest.count({ where: { approvedById: { in: deleteIds } } }),
    credentialsByOwner: await prisma.userCredential.count({ where: { userId: { in: deleteIds } } }),
    credentialsByGenerator: await prisma.userCredential.count({ where: { generatedBy: { in: deleteIds } } }),
    credentialVersionsByCreator: await prisma.credentialVersion.count({ where: { createdBy: { in: deleteIds } } }),
    lockedCredentials: await prisma.lockedCredential.count({ where: { userId: { in: deleteIds } } }),
    deptAssignmentTechnicians: await prisma.departmentAssignmentTechnician.count({ where: { userId: { in: deleteIds } } }),
    maintenanceWindowsToDelete: windowIdsToDelete.length,
    maintenanceCompletionsForThoseWindows: completionIdsForWindows.length,
    maintenanceCompletionsByDeletedUsers: await prisma.maintenanceCompletion.count({ where: { completedById: { in: deleteIds } } }),
    maintenanceWindowsToUnassign: await prisma.maintenanceWindow.count({ where: { assignedToId: { in: deleteIds } } })
  };

  console.log(JSON.stringify({ impact: stats }, null, 2));

  if (!APPLY) {
    logStep("Dry-run only. Re-run with --apply to perform deletion.");
    return;
  }

  const idChunks = chunk(deleteIds, 200);
  const windowIdChunks = chunk(windowIdsToDelete, 200);
  const completionIdChunks = chunk(completionIdsForWindows, 200);

  logStep("Nulling optional FKs referencing users-to-delete...");
  for (const ids of idChunks) {
    await prisma.emailNotification.updateMany({
      where: { recipientUserId: { in: ids } },
      data: { recipientUserId: null }
    });

    await prisma.ldapSyncRun.updateMany({
      where: { triggeredByUserId: { in: ids } },
      data: { triggeredByUserId: null }
    });

    await prisma.itemRequest.updateMany({
      where: { itReviewedById: { in: ids } },
      data: { itReviewedById: null, itReviewedAt: null }
    });

    await prisma.itemRequest.updateMany({
      where: { approvedById: { in: ids } },
      data: { approvedById: null, approvedAt: null }
    });

    await prisma.maintenanceWindow.updateMany({
      where: { assignedToId: { in: ids } },
      data: {
        assignedToId: null,
        assignmentTimestamp: null,
        assignmentReason: null,
        departmentId: null
      }
    });
  }

  logStep("Deleting direct children of users-to-delete...");
  for (const ids of idChunks) {
    await prisma.inAppNotification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.departmentAssignmentTechnician.deleteMany({ where: { userId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
  }

  // Credentials & versions
  logStep("Deleting credentials/versions tied to users-to-delete...");
  for (const ids of idChunks) {
    await prisma.credentialVersion.deleteMany({ where: { createdBy: { in: ids } } });
    await prisma.userCredential.deleteMany({ where: { generatedBy: { in: ids } } });
    await prisma.userCredential.deleteMany({ where: { userId: { in: ids } } });
    await prisma.lockedCredential.deleteMany({ where: { userId: { in: ids } } });
  }

  // Requests by deleted users
  logStep("Deleting item requests submitted by users-to-delete...");
  for (const ids of idChunks) {
    await prisma.itemRequest.deleteMany({ where: { requesterId: { in: ids } } });
  }

  // Maintenance: remove completions and windows that would block user deletion (createdById is required).
  logStep("Deleting maintenance completions/windows tied to users-to-delete...");

  for (const ids of idChunks) {
    // Covers the case where a completion exists on a window we are NOT deleting.
    await prisma.maintenanceCompletion.deleteMany({ where: { completedById: { in: ids } } });
  }

  for (const ids of completionIdChunks) {
    // Redundant with onDelete cascade, but avoids relying on DB referential actions.
    await prisma.checklistItemCompletion.deleteMany({ where: { completionId: { in: ids } } });
  }

  for (const ids of windowIdChunks) {
    await prisma.maintenanceCompletion.deleteMany({ where: { windowId: { in: ids } } });
    await prisma.maintenanceWindowDeviceType.deleteMany({ where: { windowId: { in: ids } } });
    await prisma.maintenanceWindow.deleteMany({ where: { id: { in: ids } } });
  }

  logStep("Deleting users...");
  for (const ids of idChunks) {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  const remaining = await prisma.user.count();
  const keepStillExists = await prisma.user.findUnique({
    where: { username: KEEP_USERNAME },
    select: { id: true, username: true, role: true, status: true }
  });

  console.log(JSON.stringify({ remainingUsers: remaining, keepStillExists }, null, 2));
};

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

