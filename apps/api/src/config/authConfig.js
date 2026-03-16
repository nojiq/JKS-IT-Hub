import { z } from "zod";

const toBoolean = (value, defaultValue = false) => {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return value.toLowerCase() === "true";
};

const toNumber = (value) => {
  if (value === undefined || value === "") {
    return undefined;
  }
  if (!/^\d+$/.test(value)) {
    return undefined;
  }
  return Number(value);
};

const toCsvList = (value) => {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const envSchema = z.object({
  LDAP_URL: z.string().min(1),
  LDAP_BASE_DN: z.string().min(1),
  LDAP_BIND_DN: z.string().min(1),
  LDAP_BIND_PASSWORD: z.string().min(1),
  LDAP_USER_FILTER: z.string().min(1),
  LDAP_SYNC_FILTER: z.string().min(1),
  LDAP_SYNC_ATTRIBUTES: z.string().min(1),
  LDAP_SYNC_USERNAME_ATTRIBUTE: z.string().min(1),
  LDAP_SYNC_EXCLUDE_USERNAME_REGEX: z.string().optional(),
  LDAP_SYNC_PAGE_SIZE: z.string().optional(),
  LDAP_SYNC_STALE_AFTER_MINUTES: z.string().optional(),
  LDAP_USE_STARTTLS: z.string().optional(),
  LDAP_REJECT_UNAUTHORIZED: z.string().optional(),
  LDAP_TLS_CA_PATH: z.string().optional(),
  JWT_SECRET: z.string().min(16),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  JWT_EXPIRES_IN: z.string().min(1),
  AUTH_COOKIE_NAME: z.string().optional(),
  AUTH_COOKIE_SECURE: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  MAINTENANCE_SCHEDULE_ENABLED: z.string().optional(),
  MAINTENANCE_SCHEDULE_CRON: z.string().optional(),
  MAINTENANCE_SCHEDULE_TIMEZONE: z.string().optional(),
  MAINTENANCE_SCHEDULE_RETRY_ATTEMPTS: z.string().optional(),
  MAINTENANCE_SCHEDULE_RETRY_DELAY_MS: z.string().optional()
});

export const getAuthConfig = () => {
  const env = envSchema.parse(process.env);
  const staleMinutesRaw = toNumber(env.LDAP_SYNC_STALE_AFTER_MINUTES);
  const staleMinutes = staleMinutesRaw ? Math.max(1, staleMinutesRaw) : 60;

  return {
    ldap: {
      url: env.LDAP_URL,
      baseDn: env.LDAP_BASE_DN,
      bindDn: env.LDAP_BIND_DN,
      bindPassword: env.LDAP_BIND_PASSWORD,
      userFilter: env.LDAP_USER_FILTER,
      useStartTls: toBoolean(env.LDAP_USE_STARTTLS, false),
      rejectUnauthorized: toBoolean(env.LDAP_REJECT_UNAUTHORIZED, true),
      tlsCaPath: env.LDAP_TLS_CA_PATH,
      timeoutMs: 5000,
      connectTimeoutMs: 5000
    },
    jwt: {
      secret: env.JWT_SECRET,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: env.JWT_EXPIRES_IN
    },
    cookie: {
      name: env.AUTH_COOKIE_NAME ?? "it-hub-session",
      secure: toBoolean(env.AUTH_COOKIE_SECURE, true),
      sameSite: "lax"
    },
    ldapSync: {
      filter: env.LDAP_SYNC_FILTER,
      attributes: toCsvList(env.LDAP_SYNC_ATTRIBUTES),
      usernameAttribute: env.LDAP_SYNC_USERNAME_ATTRIBUTE,
      excludeUsernameRegex: env.LDAP_SYNC_EXCLUDE_USERNAME_REGEX,
      pageSize: toNumber(env.LDAP_SYNC_PAGE_SIZE),
      staleAfterMs: staleMinutes * 60 * 1000
    },
    cors: {
      origin: env.CORS_ORIGIN ?? "http://localhost:5176"
    },
    maintenance: {
      enabled: toBoolean(env.MAINTENANCE_SCHEDULE_ENABLED, true),
      schedule: env.MAINTENANCE_SCHEDULE_CRON ?? "0 0 * * *",
      timezone: env.MAINTENANCE_SCHEDULE_TIMEZONE ?? "UTC",
      retryAttempts: toNumber(env.MAINTENANCE_SCHEDULE_RETRY_ATTEMPTS) ?? 3,
      retryDelayMs: toNumber(env.MAINTENANCE_SCHEDULE_RETRY_DELAY_MS) ?? 1000
    }
  };
};
