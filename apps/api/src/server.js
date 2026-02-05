import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifySse from "fastify-sse-v2";
import { getAuthConfig } from "./config/authConfig.js";

const normalizeCorsOrigins = (originValue) => {
  if (originValue === undefined || originValue === null) return [];
  if (typeof originValue === 'boolean') {
    return originValue === true ? true : [];
  }
  const normalized = String(originValue).trim();
  if (normalized === "*" || normalized.toLowerCase() === "true") {
    return true;
  }
  return normalized
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export default async function app(fastify, options) {
  const config = options?.config ?? getAuthConfig();

  const allowedOrigins = normalizeCorsOrigins(config.cors.origin);

  await fastify.register(cookie);
  await fastify.register(cors, {
    origin: (origin, callback) => {
      if (allowedOrigins === true) {
        callback(null, true);
        return;
      }
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, allowedOrigins.includes(origin));
    },
    credentials: true
  });
  await fastify.register(fastifySse);

  // Register scheduler
  await fastify.register(import("./plugins/scheduler.js"));

  fastify.get("/health", async () => ({ status: "ok" }));

  // Feature routes will be registered here as they are implemented in future stories
  // Shared Repos
  const userRepo = await import("./features/users/repo.js");
  const auditRepo = await import("./features/audit/repo.js");

  // Feature routes will be registered here as they are implemented in future stories
  await fastify.register(import("./features/auth/routes.js"), {
    config,
    userRepo,
    auditRepo
  });

  // Register LDAP feature (includes scheduled sync)
  await fastify.register(import("./features/ldap/index.js"), {
    config,
    userRepo,
    auditRepo,
    syncRepo: await import("./features/ldap/repo.js")
  });

  await fastify.register(import("./features/users/routes.js"), {
    config,
    userRepo,
    auditRepo
  });

  await fastify.register(import("./features/audit/routes.js"), {
    config,
    userRepo,
    auditRepo
  });


  // Credential Routes
  const credentialService = await import("./features/credentials/service.js");

  await fastify.register(import("./features/credentials/routes.js"), {
    prefix: "/api/v1/credential-templates",
    config,
    userRepo,
    credentialService,
    auditRepo
  });

  await fastify.register(import("./features/credentials/routes.js"), {
    prefix: "/api/v1/credentials",
    config,
    userRepo,
    credentialService,
    auditRepo
  });

  // System Configs routes
  const systemConfigService = await import("./features/system-configs/service.js");
  await fastify.register(import("./features/system-configs/routes.js"), {
    prefix: "/api/v1/system-configs",
    config,
    userRepo,
    systemConfigService: {
      getSystemConfigs: systemConfigService.getSystemConfigs,
      getSystemConfig: systemConfigService.getSystemConfig,
      createSystemConfig: systemConfigService.createSystemConfig,
      updateSystemConfig: systemConfigService.updateSystemConfig,
      deleteSystemConfig: systemConfigService.deleteSystemConfig,
      getAvailableLdapFields: systemConfigService.getAvailableLdapFields
    },
    auditRepo
  });

  // Normalization rules routes
  const normalizationRulesService = await import("./features/normalization-rules/service.js");
  await fastify.register(import("./features/normalization-rules/routes.js"), {
    prefix: "/api/v1/normalization-rules",
    config,
    userRepo,
    normalizationRulesService,
    auditRepo
  });

  // Export routes
  await fastify.register(import("./features/exports/routes.js"), {
    prefix: "/api/v1",
    config,
    userRepo
  });
}
