import { requireItUser } from "../../shared/auth/requireItUser.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";
import { LdapSyncInProgressError } from "./syncService.js";

export default async function (app, { config, userRepo, syncRunner, syncRepo, eventChannel }) {

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

        const run = await syncRepo.getLatestSyncRun();
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
