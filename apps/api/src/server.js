import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifySse from "fastify-sse-v2";
import fastifyMultipart from "@fastify/multipart";
import { getAuthConfig } from "./config/authConfig.js";
import { fastifySchedule } from "@fastify/schedule";

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

  // Register multipart for file uploads
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
      files: 1 // Only one file per request
    }
  });

  // Register scheduler
  await fastify.register(fastifySchedule);

  fastify.get("/health", async () => ({ status: "ok" }));

  // Feature routes will be registered here as they are implemented in future stories
  // Shared Repos
  const userRepo = await import("./features/users/repo.js");
  const auditRepo = await import("./features/audit/repo.js");
  const requestRepo = await import("./features/requests/repo.js");
  const maintenanceRepo = await import("./features/maintenance/repo.js");

  // Static file serving for uploads (with authentication)
  await fastify.register(import("./plugins/staticFiles.js"), {
    config,
    userRepo,
    requestRepo,
    maintenanceRepo
  });

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

  // Onboarding routes
  const onboardingService = await import("./features/onboarding/service.js");
  await fastify.register(import("./features/onboarding/routes.js"), {
    prefix: "/api/v1/onboarding",
    config,
    userRepo,
    onboardingService,
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

  // Maintenance Routes & Jobs
  const maintenanceService = await import("./features/maintenance/service.js");
  const { createMaintenanceJob } = await import("./features/maintenance/jobs.js");

  await fastify.register(import("./features/maintenance/routes.js"), {
    prefix: "/api/v1/maintenance",
    config,
    userRepo,
    maintenanceService,
    auditRepo
  });

  const maintenanceJob = createMaintenanceJob({ logger: fastify.log, config });
  if (maintenanceJob && fastify.scheduler) {
    fastify.scheduler.addCronJob(maintenanceJob);
    fastify.log.info("Maintenance scheduled job registered");
  } else if (!maintenanceJob) {
    fastify.log.info("Maintenance scheduled job is disabled");
  } else {
    fastify.log.warn("Scheduler not available, Maintenance status job NOT registered");
  }

  // Request Routes
  await fastify.register(import("./features/requests/routes.js"), {
    prefix: "/api/v1/requests",
    config,
    userRepo,
    auditRepo
  });

  // SSE Route
  const { registerSSERoute } = await import("./features/notifications/sseHandler.js");
  registerSSERoute(fastify, { config, userRepo });

  // Notification Routes
  await fastify.register(import("./features/notifications/routes.js"), {
    prefix: "/api/v1/notifications",
    config,
    userRepo
  });

  // Export routes
  await fastify.register(import("./features/exports/routes.js"), {
    prefix: "/api/v1",
    config,
    userRepo
  });
}
