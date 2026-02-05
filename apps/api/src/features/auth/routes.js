
import { z } from "zod";
import { authenticateLdapUser } from "../ldap/service.js";
import { signSessionToken, parseDurationToSeconds } from "../../shared/auth/jwt.js";
import { getSessionFromRequest } from "../../shared/auth/session.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";

const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1)
});

export default async function authRoutes(app, { config, userRepo, ldapAuthFn, auditRepo }) {

    // Default to the imported function if not provided (for backward compat or simple usage), 
    // but typically we should inject it.
    const authenticate = ldapAuthFn || authenticateLdapUser;

    // Helper to get client IP (prioritize X-Forwarded-For for proxy scenarios)
    const getClientIp = (request) => {
        const forwarded = request.headers['x-forwarded-for'];
        if (forwarded) {
            // X-Forwarded-For can be a comma-separated list; take the first (original client)
            return forwarded.split(',')[0].trim();
        }
        return request.ip || request.socket.remoteAddress || 'unknown';
    };

    // Helper to log audit failures with structured context for monitoring/alerting
    const logAuditFailure = (request, action, context, error) => {
        request.log.error({
            err: error,
            action,
            ...context,
            msg: `CRITICAL: Failed to create audit log for ${action}`
        });
    };

    app.post("/auth/login", async (request, reply) => {
        const validation = loginSchema.safeParse(request.body);
        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Request",
                detail: "Username and password are required."
            }));
            return;
        }

        const { username, password } = validation.data;

        try {
            // 1. Authenticate against LDAP
            const ldapUser = await authenticate(config.ldap, { username, password });

            // 2. Find or create local user
            // Note: We use findOrCreateUser to ensure we have a local record with default role/status
            const user = await userRepo.findOrCreateUser({
                username: username,
                // Default role is requester, default status is active (handled by repo/schema default)
            });

            // 3. CHECK STATUS (Critical for Story 1.8)
            if (userRepo.isUserDisabled(user)) {
                sendProblem(reply, createProblemDetails({
                    status: 403,
                    title: "Account Disabled",
                    detail: "Your account is disabled. Contact IT to regain access."
                }));
                return;
            }

            // 4. Issue Session
            const token = await signSessionToken({
                subject: user.id,
                payload: {
                    username: user.username,
                    role: user.role
                }
            }, config.jwt);

            const maxAge = parseDurationToSeconds(config.jwt.expiresIn) ?? 43200; // 12h default

            reply.setCookie(config.cookie.name, token, {
                path: "/",
                httpOnly: true,
                secure: config.cookie.secure,
                sameSite: config.cookie.sameSite,
                maxAge
            });

            // Audit: Successful login
            if (auditRepo?.createAuditLog) {
                try {
                    await auditRepo.createAuditLog({
                        action: "auth.login",
                        actorUserId: user.id,
                        entityType: "user",
                        entityId: user.id,
                        metadata: {
                            ip: getClientIp(request)
                        }
                    });
                } catch (auditError) {
                    logAuditFailure(request, "auth.login", { userId: user.id }, auditError);
                }
            }

            return {
                data: {
                    user: {
                        id: user.id,
                        username: user.username,
                        role: user.role,
                        status: user.status
                    }
                }
            };

        } catch (error) {
            // Handle LDAP errors or others
            if (error.name === "LdapInvalidCredentialsError") {
                // Audit: Failed login
                if (auditRepo?.createAuditLog) {
                    try {
                        await auditRepo.createAuditLog({
                            action: "auth.login_failure",
                            actorUserId: null,
                            entityType: "auth",
                            entityId: username,
                            metadata: {
                                reason: "Invalid credentials",
                                ip: getClientIp(request)
                            }
                        });
                    } catch (auditError) {
                        logAuditFailure(request, "auth.login_failure", { username }, auditError);
                    }
                }

                sendProblem(reply, createProblemDetails({
                    status: 401,
                    title: "Invalid Credentials",
                    detail: "Invalid username or password."
                }));
                return;
            }

            request.log.error(error, "Login failed");
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Authentication Failed",
                detail: "An internal error occurred during authentication."
            }));
        }
    });

    app.get("/auth/me", async (request, reply) => {
        try {
            const session = await getSessionFromRequest(request, config);
            if (!session) {
                sendProblem(reply, createProblemDetails({ status: 401, title: "Unauthorized", detail: "No active session" }));
                return;
            }

            const user = await userRepo.findUserByUsername(session.username);
            if (!user) {
                sendProblem(reply, createProblemDetails({ status: 401, title: "Unauthorized", detail: "User not found" }));
                return;
            }

            // Check if disabled - invalidate session if so (Story 1.8)
            if (userRepo.isUserDisabled(user)) {
                reply.clearCookie(config.cookie.name);
                sendProblem(reply, createProblemDetails({ status: 403, title: "Account Disabled", detail: "Your account has been disabled." }));
                return;
            }

            return {
                data: {
                    user: {
                        id: user.id,
                        username: user.username,
                        role: user.role,
                        status: user.status
                    }
                }
            };
        } catch (e) {
            request.log.error(e);
            sendProblem(reply, createProblemDetails({ status: 401, title: "Unauthorized", detail: "Invalid session" }));
        }
    });

    app.post("/auth/logout", async (request, reply) => {
        // Get session to identify the user for audit
        let session;
        try {
            session = await getSessionFromRequest(request, config);
        } catch (sessionError) {
            // Session might be invalid/expired, continue with logout
            request.log.debug(sessionError, "Session retrieval failed during logout");
        }

        // Audit: Logout
        if (session && auditRepo?.createAuditLog) {
            try {
                await auditRepo.createAuditLog({
                    action: "auth.logout",
                    actorUserId: session.sub,
                    entityType: "user",
                    entityId: session.sub,
                    metadata: {
                        ip: getClientIp(request)
                    }
                });
            } catch (auditError) {
                logAuditFailure(request, "auth.logout", { userId: session.sub }, auditError);
            }
        }

        reply.clearCookie(config.cookie.name, { path: "/" });
        return { data: { success: true } };
    });
}
