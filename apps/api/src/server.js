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

  fastify.get("/health", async () => ({ status: "ok" }));

  // Feature routes will be registered here as they are implemented in future stories
  // await fastify.register(authRoutes, { config });
  // await fastify.register(ldapRoutes, { config });
  // await fastify.register(usersRoutes, { config });
}
