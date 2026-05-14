import { requireItUser } from "../../shared/auth/requireItUser.js";
import { requireAdminOrHead } from "../../shared/auth/requireAdminOrHead.js";
import { ASSIGNABLE_ROLES, assertCanAssignRole } from "../../shared/auth/roleAssignment.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";
import { z } from "zod";
import { buildOrgSnapshotFromPulsePicker } from "./pulseOrgSnapshot.js";

export default async function (app, { config, userRepo, auditRepo, userFieldRepo }) {
    let loadedUserFieldRepo = null;
    const getUserFieldRepo = async () => {
        if (userFieldRepo) {
            return userFieldRepo;
        }
        if (!process.env.DATABASE_URL) {
            return null;
        }
        loadedUserFieldRepo ??= await import("./profileFieldsRepo.js");
        return loadedUserFieldRepo;
    };
    const mapUser = (user, profileFields) => {
        const mapped = {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
        ldapSyncedAt: user.ldapSyncedAt,
        ldapFields: user.ldapAttributes || {},
        orgSnapshot: user.orgSnapshot || null,
        orgSyncedAt: user.orgSyncedAt
        };

        if (profileFields !== undefined) {
            mapped.profileFields = profileFields;
        }

        return mapped;
    };


    app.get("/users", async (request, reply) => {
        const actor = await requireItUser(request, reply, { config, userRepo });
        if (!actor) return;

        // Extract query parameters
        const { search, role, status, page, perPage } = request.query;

        // Parse pagination
        const pagination = {
            page: page ? parseInt(page, 10) : 1,
            perPage: perPage ? parseInt(perPage, 10) : 20
        };

        // Build filters object
        const filters = {};
        if (search) filters.search = search;
        if (role) filters.role = role;
        if (status) filters.status = status;

        // Use filtered list if any filters or pagination params provided
        const hasFilters = Object.keys(filters).length > 0 || page || perPage;

        if (hasFilters) {
            const { data: users, total, page: currentPage, perPage: itemsPerPage } =
                await userRepo.listUsersFiltered(filters, pagination);

            const mappedUsers = users.map(u => ({
                id: u.id,
                username: u.username,
                role: u.role,
                status: u.status,
                ldapSyncedAt: u.ldapSyncedAt,
                ldapFields: u.ldapAttributes || {},
                orgSnapshot: u.orgSnapshot || null,
                orgSyncedAt: u.orgSyncedAt
            }));

            return {
                data: mappedUsers,
                meta: {
                    total,
                    page: currentPage,
                    perPage: itemsPerPage,
                    fields: [config.ldapSync.usernameAttribute, ...config.ldapSync.attributes]
                }
            };
        }

        // Legacy response format when no filters
        const users = await userRepo.listUsers();

        const mappedUsers = users.map(u => ({
            id: u.id,
            username: u.username,
            role: u.role,
            status: u.status,
            ldapSyncedAt: u.ldapSyncedAt,
            ldapFields: u.ldapAttributes || {},
            orgSnapshot: u.orgSnapshot || null,
            orgSyncedAt: u.orgSyncedAt
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

        const profileFieldRepository = await getUserFieldRepo();
        const profileFields = profileFieldRepository
            ? await profileFieldRepository.listProfileFieldsForUser(id, { includeSensitive: true })
            : [];

        return {
            data: {
                fields: [config.ldapSync.usernameAttribute, ...config.ldapSync.attributes],
                user: mapUser(user, profileFields)
            }
        };
    });

    app.patch("/users/:id/profile-fields", async (request, reply) => {
        const actor = await requireItUser(request, reply, {
            config,
            userRepo,
            forbiddenDetail: "Only IT, Admin, and Head of IT can edit user profile fields."
        });
        if (!actor) return;

        const { id } = request.params;
        const target = await userRepo.findUserById(id);
        if (!target) {
            sendProblem(reply, createProblemDetails({
                status: 404,
                title: "Not Found",
                detail: "User not found"
            }));
            return;
        }

        const values = request.body?.values;
        if (!values || typeof values !== "object" || Array.isArray(values)) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: "values must be an object keyed by field key."
            }));
            return;
        }

        try {
            const profileFieldRepository = await getUserFieldRepo();
            if (!profileFieldRepository) {
                sendProblem(reply, createProblemDetails({
                    status: 500,
                    title: "Profile Fields Unavailable",
                    detail: "Profile field storage is not configured."
                }));
                return;
            }

            const profileFields = await profileFieldRepository.updateProfileFieldValues({
                userId: id,
                values,
                updatedBy: actor.id
            });

            if (auditRepo) {
                await auditRepo.createAuditLog({
                    action: "user.profile_fields_update",
                    actorUserId: actor.id,
                    entityType: "user",
                    entityId: id,
                    metadata: {
                        changedFields: Object.keys(values)
                    }
                });
            }

            return {
                data: {
                    profileFields
                }
            };
        } catch (error) {
            if (["INVALID_PROFILE_FIELDS", "UNKNOWN_PROFILE_FIELD"].includes(error.code)) {
                sendProblem(reply, createProblemDetails({
                    status: 400,
                    title: "Invalid Input",
                    detail: error.message
                }));
                return;
            }

            throw error;
        }
    });

    const pulseOrgEntitySchema = z.object({
        id: z.string().trim().max(191),
        name: z.string().trim().max(191)
    });

    const patchUserPulseOrgSchema = z.object({
        pulseOrg: z.object({
            division: pulseOrgEntitySchema.nullable().optional(),
            department: pulseOrgEntitySchema.nullable().optional(),
            section: pulseOrgEntitySchema.nullable().optional()
        })
    });

    app.patch("/users/:id/pulse-org", async (request, reply) => {
        const actor = await requireItUser(request, reply, {
            config,
            userRepo,
            forbiddenDetail: "Only IT, Admin, and Head of IT can update JKSPulse org assignment."
        });
        if (!actor) return;

        const { id } = request.params;
        const target = await userRepo.findUserById(id);
        if (!target) {
            sendProblem(reply, createProblemDetails({
                status: 404,
                title: "Not Found",
                detail: "User not found"
            }));
            return;
        }

        const parsed = patchUserPulseOrgSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: parsed.error.issues.map((i) => i.message).join("; ") || "Invalid pulse org payload."
            }));
            return;
        }

        const orgSnapshot = buildOrgSnapshotFromPulsePicker(parsed.data.pulseOrg);
        const updated = await userRepo.updateUserOrgSnapshot(id, orgSnapshot);

        if (auditRepo) {
            await auditRepo.createAuditLog({
                action: "user.pulse_org_update",
                actorUserId: actor.id,
                entityType: "user",
                entityId: id,
                metadata: {
                    orgSnapshot: updated.orgSnapshot ?? null
                }
            });
        }

        return {
            data: {
                user: mapUser(updated)
            }
        };
    });

    app.patch("/users/:id/status", async (request, reply) => {
        const actor = await requireAdminOrHead(request, reply, {
            config,
            userRepo,
            forbiddenDetail: "Only Admin and Head of IT can change user status."
        });
        if (!actor) return;

        const { id } = request.params;
        const target = await userRepo.findUserById(id);
        if (!target) {
            sendProblem(reply, createProblemDetails({
                status: 404,
                title: "Not Found",
                detail: "User not found"
            }));
            return;
        }

        const requestedStatus = request.body?.status;
        if (!["active", "disabled"].includes(requestedStatus)) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: "status must be either 'active' or 'disabled'."
            }));
            return;
        }

        const updated = await userRepo.updateUserStatus(id, requestedStatus);

        if (auditRepo) {
            await auditRepo.createAuditLog({
                action: "user.status_change",
                actorUserId: actor.id,
                entityType: "user",
                entityId: id,
                metadata: {
                    changes: [
                        {
                            field: "status",
                            old: target.status,
                            new: updated.status
                        }
                    ]
                }
            });
        }

        return {
            data: {
                user: mapUser(updated)
            }
        };
    });

    app.patch("/users/:id/role", async (request, reply) => {
        const actor = await requireItUser(request, reply, {
            config,
            userRepo,
            forbiddenDetail: "Only IT staff can change user roles."
        });
        if (!actor) return;

        const { id } = request.params;
        const target = await userRepo.findUserById(id);
        if (!target) {
            sendProblem(reply, createProblemDetails({
                status: 404,
                title: "Not Found",
                detail: "User not found"
            }));
            return;
        }

        if (actor.id === id) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "You cannot change your own role."
            }));
            return;
        }

        const requestedRole = request.body?.role;
        if (!ASSIGNABLE_ROLES.includes(requestedRole)) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: `role must be one of: ${ASSIGNABLE_ROLES.join(", ")}.`
            }));
            return;
        }

        const decision = assertCanAssignRole(actor, target, requestedRole);
        if (!decision.ok) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: decision.detail
            }));
            return;
        }

        if (target.role === requestedRole) {
            return {
                data: {
                    user: mapUser(target)
                }
            };
        }

        const updated = await userRepo.updateUserRole(id, requestedRole);

        if (auditRepo) {
            await auditRepo.createAuditLog({
                action: "user.role_update",
                actorUserId: actor.id,
                entityType: "user",
                entityId: id,
                metadata: {
                    changes: [
                        {
                            field: "role",
                            old: target.role,
                            new: updated.role
                        }
                    ]
                }
            });
        }

        return {
            data: {
                user: mapUser(updated)
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
                "user.ldap_create",
                "user.ldap_update",
                "user.update",
                "user.role_update",
                "user.profile_fields_update",
                "user.pulse_org_update",
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

            else if (log.action === 'user.ldap_create') {
                history.push({
                    id: log.id,
                    timestamp: log.createdAt,
                    field: 'account',
                    oldValue: null,
                    newValue: 'Created from LDAP sync',
                    actor: actorName,
                    action: log.action,
                    type: 'lifecycle_event',
                    metadata: log.metadata
                });
            }

            else if (log.action === "user.pulse_org_update") {
                history.push({
                    id: log.id,
                    timestamp: log.createdAt,
                    field: "JKSPulse org",
                    oldValue: null,
                    newValue: "Updated",
                    actor: actorName,
                    action: log.action,
                    type: "field_change"
                });
            }

            else if (log.action === "user.profile_fields_update") {
                history.push({
                    id: log.id,
                    timestamp: log.createdAt,
                    field: "Profile fields",
                    oldValue: null,
                    newValue: Array.isArray(log.metadata?.changedFields)
                        ? log.metadata.changedFields.join(", ")
                        : "Updated",
                    actor: actorName,
                    action: log.action,
                    type: "field_change"
                });
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
