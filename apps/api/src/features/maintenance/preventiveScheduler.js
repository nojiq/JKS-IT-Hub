import { prisma } from "../../shared/db/prisma.js";

const OPEN_RUN_STATUSES = ["scheduled", "due", "in_progress", "overdue"];
const TERMINAL_RUN_STATUSES = ["completed", "cancelled", "skipped"];

export const startOfBusinessDay = (date) => {
    const value = new Date(date);
    value.setUTCHours(0, 0, 0, 0);
    return value;
};

export const addDays = (date, days) => {
    const value = new Date(date);
    value.setUTCDate(value.getUTCDate() + days);
    return value;
};

const daysInUtcMonth = (year, monthIndex) => {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
};

export const addMonthsClamped = (date, months) => {
    const source = new Date(date);
    const targetMonthIndex = source.getUTCMonth() + months;
    const targetYear = source.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
    const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
    const targetDay = Math.min(source.getUTCDate(), daysInUtcMonth(targetYear, normalizedMonth));

    return new Date(Date.UTC(
        targetYear,
        normalizedMonth,
        targetDay,
        source.getUTCHours(),
        source.getUTCMinutes(),
        source.getUTCSeconds(),
        source.getUTCMilliseconds()
    ));
};

const copyChecklistItem = (item) => ({
    id: item.id,
    sortOrder: item.sortOrder,
    title: item.title,
    description: item.description ?? null,
    required: item.required,
    evidenceRequired: item.evidenceRequired
});

const buildChecklistSnapshot = (template) => {
    if (!template) return null;
    return {
        templateId: template.id,
        name: template.name,
        version: template.version,
        items: (template.items || [])
            .map(copyChecklistItem)
            .sort((a, b) => a.sortOrder - b.sortOrder)
    };
};

const getRunStatusForDate = (run, today, graceDays = 0) => {
    if (TERMINAL_RUN_STATUSES.includes(run.status)) return run.status;

    const overdueThreshold = addDays(today, -graceDays);
    if (run.dueDate < overdueThreshold) return "overdue";
    if (run.dueDate <= today && run.status === "scheduled") return "due";
    return run.status;
};

export const updateRunStatusFromDate = async (tx, run, today, graceDays = 0) => {
    const nextStatus = getRunStatusForDate(run, today, graceDays);
    if (nextStatus === run.status) return { ...run, statusUpdated: false };

    const updated = await tx.maintenanceRun.update({
        where: { id: run.id },
        data: { status: nextStatus }
    });
    return { ...updated, statusUpdated: true };
};

const getLatestRun = (tx, assignmentId) => {
    return tx.maintenanceRun.findFirst({
        where: {
            assignmentId,
            status: {
                in: [...TERMINAL_RUN_STATUSES, ...OPEN_RUN_STATUSES]
            }
        },
        orderBy: [
            { completedAt: "desc" },
            { dueDate: "desc" },
            { createdAt: "desc" }
        ]
    });
};

const createRunForAssignment = async (tx, assignment, dueDate) => {
    const template = assignment.profile.activeTemplate;
    const snapshot = buildChecklistSnapshot(template);
    const items = snapshot?.items || [];
    const userId = assignment.user?.status === "disabled" ? null : assignment.userId;

    try {
        return {
            created: true,
            run: await tx.maintenanceRun.create({
                data: {
                    assignmentId: assignment.id,
                    profileId: assignment.profileId,
                    assetId: assignment.assetId,
                    userId,
                    checklistTemplateId: template?.id ?? null,
                    checklistVersion: template?.version ?? null,
                    checklistSnapshot: snapshot,
                    dueDate,
                    status: "scheduled",
                    items: {
                        create: items.map((item) => ({
                            checklistItemId: item.id,
                            sortOrder: item.sortOrder,
                            title: item.title,
                            description: item.description,
                            required: item.required,
                            evidenceRequired: item.evidenceRequired,
                            status: "pending"
                        }))
                    }
                }
            })
        };
    } catch (error) {
        if (error?.code !== "P2002") throw error;
        return {
            created: false,
            run: await tx.maintenanceRun.findUnique({
                where: {
                    assignmentId_dueDate: {
                        assignmentId: assignment.id,
                        dueDate
                    }
                }
            })
        };
    }
};

const processAssignment = async (assignment, today, windowEnd, tx) => {
    const latestRun = await getLatestRun(tx, assignment.id);
    const graceDays = assignment.profile.gracePeriodDays ?? 0;

    if (latestRun && OPEN_RUN_STATUSES.includes(latestRun.status)) {
        const updated = await updateRunStatusFromDate(tx, latestRun, today, graceDays);
        return {
            created: false,
            statusUpdated: Boolean(updated.statusUpdated)
        };
    }

    const anchorDate = latestRun?.completedAt ?? assignment.startDate;
    if (!anchorDate) {
        return { created: false, statusUpdated: false };
    }

    const nextDueDate = addMonthsClamped(anchorDate, assignment.profile.intervalMonths);
    if (nextDueDate > windowEnd) {
        return { created: false, statusUpdated: false };
    }

    const { created, run } = await createRunForAssignment(tx, assignment, nextDueDate);
    const updated = await updateRunStatusFromDate(tx, run, today, graceDays);

    return {
        created,
        statusUpdated: Boolean(updated.statusUpdated)
    };
};

export const dailyPreventiveMaintenanceJob = async (options = {}) => {
    const {
        now = new Date(),
        windowDays = 30,
        db = prisma
    } = options;

    const today = startOfBusinessDay(now);
    const windowEnd = addDays(today, windowDays);

    const assignments = await db.maintenanceAssignment.findMany({
        where: {
            status: "active",
            startDate: { lte: windowEnd },
            profile: { isActive: true }
        },
        include: {
            profile: {
                include: {
                    activeTemplate: {
                        include: {
                            items: {
                                orderBy: { sortOrder: "asc" }
                            }
                        }
                    }
                }
            },
            asset: true,
            user: true
        }
    });

    const result = {
        evaluatedCount: assignments.length,
        createdCount: 0,
        statusUpdatedCount: 0
    };

    for (const assignment of assignments) {
        const itemResult = await db.$transaction((tx) =>
            processAssignment(assignment, today, windowEnd, tx)
        );
        if (itemResult.created) result.createdCount += 1;
        if (itemResult.statusUpdated) result.statusUpdatedCount += 1;
    }

    return result;
};
