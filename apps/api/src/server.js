import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifySse from "fastify-sse-v2";
import { getAuthConfig } from "./config/authConfig.js";


export default async function app(fastify, options = {}) {
  const config = options.config ?? getAuthConfig();

  await fastify.register(cookie);
  await fastify.register(cors, {
    origin: config.cors.origin,
    credentials: true
  });
  await fastify.register(fastifySse);

  // Register scheduler
  await fastify.register(import("./plugins/scheduler.js"));

  fastify.get("/health", async () => ({ status: "ok" }));

  // Feature routes will be registered here as they are implemented in future stories
  await fastify.register(import("./features/auth/routes.js"), {
    config,
    userRepo: await import("./features/users/repo.js"),
    auditRepo: await import("./features/audit/repo.js")
  });

  // Register LDAP feature (includes scheduled sync)
  await fastify.register(import("./features/ldap/index.js"));

  await fastify.register(import("./features/users/routes.js"), {
    config,
    userRepo: await import("./features/users/repo.js")
  });

  await fastify.register(import("./features/audit/routes.js"), {
    config,
    userRepo: await import("./features/users/repo.js"),
    auditRepo: await import("./features/audit/repo.js")
  });
}
