import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

export const parseDurationToSeconds = (value) => {
  if (!value) {
    return undefined;
  }
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  const match = value.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return undefined;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400
  };

  return amount * multipliers[unit];
};

export const signSessionToken = async ({ subject, payload }, config) => {
  const key = encoder.encode(config.secret);

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject(String(subject))
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setExpirationTime(config.expiresIn)
    .sign(key);
};

export const verifySessionToken = async (token, config) => {
  const key = encoder.encode(config.secret);
  const { payload } = await jwtVerify(token, key, {
    issuer: config.issuer,
    audience: config.audience
  });

  return payload;
};
