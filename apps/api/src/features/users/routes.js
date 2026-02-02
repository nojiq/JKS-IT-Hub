import { requireItUser } from "../../shared/auth/requireItUser.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";

export default async function (app, { config, userRepo }) {

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
}
