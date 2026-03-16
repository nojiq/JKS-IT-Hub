import { getSessionFromRequest } from "./session.js";
import { createProblemDetails, sendProblem } from "../errors/problemDetails.js";

const isUserDisabled = (user, userRepo) => {
    if (userRepo?.isUserDisabled) {
        return userRepo.isUserDisabled(user);
    }
    return user?.status === "disabled";
};

export const requireAuthenticated = async (
    request,
    reply,
    { config, userRepo } = {}
) => {
    let session;
    try {
        session = await getSessionFromRequest(request, config);
    } catch (error) {
        sendProblem(
            reply,
            createProblemDetails({
                status: 401,
                title: "Unauthorized",
                type: "/problems/auth/unauthorized",
                detail: "Session is invalid or expired."
            })
        );
        return null;
    }

    if (!session) {
        sendProblem(
            reply,
            createProblemDetails({
                status: 401,
                title: "Unauthorized",
                type: "/problems/auth/unauthorized",
                detail: "Missing session cookie."
            })
        );
        return null;
    }

    const user = await userRepo.findUserByUsername?.(session.username);
    if (!user) {
        sendProblem(
            reply,
            createProblemDetails({
                status: 401,
                title: "Unauthorized",
                type: "/problems/auth/unauthorized",
                detail: "Session user no longer exists."
            })
        );
        return null;
    }

    if (isUserDisabled(user, userRepo)) {
        sendProblem(
            reply,
            createProblemDetails({
                status: 403,
                title: "Account disabled",
                type: "/problems/auth/account-disabled",
                detail: "Your account is disabled. Contact IT to regain access."
            })
        );
        return null;
    }

    return user;
};
