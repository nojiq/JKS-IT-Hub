import { requireItUser } from "../../shared/auth/requireItUser.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";
import { LdapSyncInProgressError } from "./syncService.js";

export default async function (app, { config, userRepo, syncRunner, syncRepo, eventChannel }) {
    const isStaleRun = (run) => {
        const staleAfterMs = config?.ldapSync?.staleAfterMs ?? 60 * 60 * 1000;
        if (!run || run.status !== "started" || !run.startedAt) {
            return false;
        }
        const startedAt = new Date(run.startedAt);
        if (Number.isNaN(startedAt.getTime())) {
            return false;
        }
        return Date.now() - startedAt.getTime() > staleAfterMs;
    };

    app.post("/ldap/sync", async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;

        try {
            const run = await syncRunner.startManualSync({ actor });
            reply.code(202).send({ data: { run } });
        } catch (error) {
            if (error instanceof LdapSyncInProgressError) {
                sendProblem(reply, createProblemDetails({
                    status: 409,
                    title: "Sync already running",
                    detail: "A sync process is currently in progress."
                }));
            } else {
                request.log.error(error);
                sendProblem(reply, createProblemDetails({
                    status: 502,
                    title: "Sync unavailable",
                    detail: "Failed to start sync process: " + error.message
                }));
            }
        }
    });

    app.get("/ldap/sync/latest", async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;

        let run = await syncRepo.getLatestSyncRun();

        // If the API crashed/restarted mid-run, the DB can retain a "started" status forever.
        // Recover by marking very old runs as failed so the UI can start a new sync.
        if (isStaleRun(run) && syncRepo?.updateSyncRun) {
            run = await syncRepo.updateSyncRun(run.id, {
                status: "failed",
                completedAt: new Date(),
                errorMessage: "Recovered stale run (app restart or crash)"
            });
        }

        reply.send({ data: { run } });
    });

    app.get("/ldap/sync/stream", async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;

        if (!eventChannel) {
            sendProblem(reply, createProblemDetails({
                status: 503,
                title: "Sync stream unavailable",
                detail: "LDAP sync event stream is not configured."
            }));
            return;
        }

        const stream = eventChannel.subscribe();
        reply.sse(stream);
    });
}
