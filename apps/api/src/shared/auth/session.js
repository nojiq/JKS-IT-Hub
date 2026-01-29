import { verifySessionToken } from "./jwt.js";

export const getSessionFromRequest = async (request, config) => {
  const token = request.cookies?.[config.cookie.name];
  if (!token) {
    return null;
  }

  return verifySessionToken(token, config.jwt);
};
