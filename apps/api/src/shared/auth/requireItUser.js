import { getSessionFromRequest } from "./session.js";
import { createProblemDetails, sendProblem } from "../errors/problemDetails.js";

const IT_ROLES = new Set(["it", "admin", "head_it"]);

const isUserDisabled = (user, userRepo) => {
  if (userRepo?.isUserDisabled) {
    return userRepo.isUserDisabled(user);
  }
  return user?.status === "disabled";
};

export const requireItUser = async (
  request,
  reply,
  { config, userRepo, forbiddenDetail = "You do not have permission to perform this action." } = {}
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
        detail: "Your account is disabled. Contact IT to regain access."
      })
    );
    return null;
  }

  if (!IT_ROLES.has(user.role)) {
    sendProblem(
      reply,
      createProblemDetails({
        status: 403,
        title: "Forbidden",
        detail: forbiddenDetail
      })
    );
    return null;
  }

  return user;
};
