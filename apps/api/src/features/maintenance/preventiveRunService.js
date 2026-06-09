import { prisma } from "../../shared/db/prisma.js";

const OPEN_RUN_STATUSES = ["scheduled", "due", "in_progress", "overdue"];
const TERMINAL_RUN_STATUSES = ["completed", "cancelled", "skipped"];
const ITEM_STATUSES = ["pending", "pass", "fail", "repair", "na"];

const notFound = (message) => {
    const error = new Error(message);
    error.statusCode = 404;
    return error;
};

const invalidState = (message) => {
    const error = new Error(message);
    error.statusCode = 409;
    return error;
};

const badRequest = (message) => {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
};

const asTrimmedString = (value) => {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed || null;
};

const asNumber = (value, field, { min = 0, max = Number.POSITIVE_INFINITY } = {}) => {
    if (value === undefined || value === null || value === "") return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
        throw badRequest(`Invalid ${field}`);
    }
    return numeric;
};

const normalizeMeasurements = (measurementType, measurements) => {
    if (measurements === undefined) return undefined;
    if (measurements === null) return null;
    if (typeof measurements !== "object" || Array.isArray(measurements)) {
        throw badRequest("Invalid measurements");
    }

    if (measurementType === "battery") {
        const designCapacityMwh = asNumber(measurements.designCapacityMwh, "design capacity", { min: 0 });
        const fullChargeCapacityMwh = asNumber(measurements.fullChargeCapacityMwh, "full charge capacity", { min: 0 });
        const cycleCount = asNumber(measurements.cycleCount, "cycle count", { min: 0 });
        return {
            batteryModel: asTrimmedString(measurements.batteryModel),
            designCapacityMwh,
            fullChargeCapacityMwh,
            cycleCount
        };
    }

    if (measurementType === "hard_drive") {
        return {
            model: asTrimmedString(measurements.model),
            sizeGb: asNumber(measurements.sizeGb, "size", { min: 0 }),
            performancePercent: asNumber(measurements.performancePercent, "performance", { min: 0, max: 100 }),
            healthPercent: asNumber(measurements.healthPercent, "health", { min: 0, max: 100 })
        };
    }

    if (Object.keys(measurements).length > 0) {
        throw badRequest("Measurements are only supported for battery and hard drive tasks");
    }
    return null;
};

const getRunOrThrow = async (runId, tx = prisma) => {
    const run = await tx.maintenanceRun.findUnique({
        where: { id: runId },
        include: { items: true }
    });
    if (!run) throw notFound("Maintenance run not found");
    return run;
};

export const startMaintenanceRun = async (runId, actorUserId, options = {}) => {
    const now = options.now ?? new Date();

    return prisma.$transaction(async (tx) => {
        const run = await getRunOrThrow(runId, tx);
        if (TERMINAL_RUN_STATUSES.includes(run.status)) {
            throw invalidState("Cannot start a terminal maintenance run");
        }
        if (!OPEN_RUN_STATUSES.includes(run.status)) {
            throw invalidState("Cannot start maintenance run from current status");
        }

        if (run.status === "in_progress") return run;

        return tx.maintenanceRun.update({
            where: { id: runId },
            data: {
                status: "in_progress",
                startedAt: run.startedAt ?? now
            }
        });
    });
};

export const updateMaintenanceRunItem = async (runItemId, data, actorUserId, options = {}) => {
    const now = options.now ?? new Date();
    if (!ITEM_STATUSES.includes(data.status)) {
        const error = new Error("Invalid maintenance run item status");
        error.statusCode = 400;
        throw error;
    }

    return prisma.$transaction(async (tx) => {
        const existing = await tx.maintenanceRunItem.findUnique({
            where: { id: runItemId },
            include: { run: true }
        });
        if (!existing) throw notFound("Maintenance run item not found");
        if (TERMINAL_RUN_STATUSES.includes(existing.run.status)) {
            throw invalidState("Cannot update item for a terminal maintenance run");
        }

        if (existing.run.status !== "in_progress") {
            await tx.maintenanceRun.update({
                where: { id: existing.runId },
                data: {
                    status: "in_progress",
                    startedAt: existing.run.startedAt ?? now
                }
            });
        }

        const isPending = data.status === "pending";
        const normalizedMeasurements = normalizeMeasurements(existing.measurementType || "none", data.measurements);
        return tx.maintenanceRunItem.update({
            where: { id: runItemId },
            data: {
                status: data.status,
                notes: data.notes ?? existing.notes,
                evidenceUrl: data.evidenceUrl ?? existing.evidenceUrl,
                ...(normalizedMeasurements !== undefined ? { measurements: normalizedMeasurements } : {}),
                completedById: isPending ? null : actorUserId,
                completedAt: isPending ? null : now
            }
        });
    });
};

export const completeMaintenanceRun = async (runId, actorUserId, options = {}) => {
    const now = options.now ?? new Date();

    return prisma.$transaction(async (tx) => {
        const run = await getRunOrThrow(runId, tx);
        if (TERMINAL_RUN_STATUSES.includes(run.status)) {
            throw invalidState("Cannot complete a terminal maintenance run");
        }

        const pendingRequired = run.items.filter((item) => item.required && item.status === "pending");
        if (pendingRequired.length > 0) {
            throw invalidState("Required checklist items are still pending");
        }

        return tx.maintenanceRun.update({
            where: { id: runId },
            data: {
                status: "completed",
                completedAt: now,
                completedById: actorUserId,
                startedAt: run.startedAt ?? now
            }
        });
    });
};
