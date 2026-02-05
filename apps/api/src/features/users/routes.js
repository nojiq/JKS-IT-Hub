import { requireItUser } from "../../shared/auth/requireItUser.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";

export default async function (app, { config, userRepo, auditRepo }) {

    app.get("/users", async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;

        const users = await userRepo.listUsers();

        const mappedUsers = users.map(u => ({
            id: u.id,
            username: u.username,
            role: u.role,
            status: u.status,
            ldapSyncedAt: u.ldapSyncedAt,
            ldapFields: u.ldapAttributes || {}
        }));

        return {
            data: {
                fields: [config.ldapSync.usernameAttribute, ...config.ldapSync.attributes],
                users: mappedUsers
            }
        };
    });

    app.get("/users/:id", async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;

        const { id } = request.params;
        const user = await userRepo.findUserById(id);

        if (!user) {
            sendProblem(reply, createProblemDetails({ status: 404, title: "Not Found", detail: "User not found" }));
            return;
        }

        return {
            data: {
                fields: [config.ldapSync.usernameAttribute, ...config.ldapSync.attributes],
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    status: user.status,
                    ldapSyncedAt: user.ldapSyncedAt,
                    ldapFields: user.ldapAttributes || {}
                }
            }
        };
    });

    app.get("/users/:id/audit-logs", async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;

        const { id } = request.params;
        const user = await userRepo.findUserById(id);

        if (!user) {
            sendProblem(reply, createProblemDetails({ status: 404, title: "Not Found", detail: "User not found" }));
            return;
        }

        // Fetch user-related audit logs including both user updates and credential events
        const logs = await auditRepo.findAuditLogsByEntity(id, "user", {
            actions: [
                "user.ldap_update",
                "user.update",
                "credentials.regenerate.preview",
                "credentials.regenerate.confirm",
                "credentials.override.preview",
                "credentials.override.confirm",
                "credentials.password.reveal"
            ],
            limit: 100
        });

        const history = [];

        for (const log of logs) {
            const actorName = log.actorUser
                ? `${log.actorUser.username} (${log.actorUser.role})`
                : "System";

            // Handle change-based audit logs (user.update, user.ldap_update)
            if (log.metadata?.changes && Array.isArray(log.metadata.changes)) {
                for (const change of log.metadata.changes) {
                    history.push({
                        id: `${log.id}-${change.field}`,
                        timestamp: log.createdAt,
                        field: change.field,
                        oldValue: change.old ?? null,
                        newValue: change.new ?? null,
                        actor: actorName,
                        action: log.action,
                        type: 'field_change'
                    });
                }
            }

            // Handle credential event logs (regenerate, override, etc.)
            else if (log.action.startsWith('credentials.')) {
                history.push({
                    id: log.id,
                    timestamp: log.createdAt,
                    field: 'credentials',
                    oldValue: null,
                    newValue: log.action.replace('credentials.', '').replace('.', ' - '),
                    actor: actorName,
                    action: log.action,
                    type: 'credential_event',
                    metadata: {
                        system: log.metadata?.system,
                        changeType: log.metadata?.changeType,
                        regeneratedSystems: log.metadata?.regeneratedSystems
                    }
                });
            }
        }

        return { data: history };
    });
}
