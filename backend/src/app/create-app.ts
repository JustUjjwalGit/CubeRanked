import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import type { AppEnv } from "../types/env.js";
import { errorHandler } from "../middleware/error-handler.js";
import { registerRoutes } from "../routes/index.js";
import { createSocketManager } from "../sockets/socket-manager.js";
import { createLogger } from "../config/logger.js";
import { buildCorsOrigins } from "../config/cors.js";

export async function createApp(env: AppEnv) {
  const logger = createLogger(env);
  const app = Fastify({ logger });

  app.decorate("env", env);
  app.decorate("startedAt", Date.now());

  await app.register(cors, {
    origin: buildCorsOrigins(env),
    credentials: true,
  });
  await app.register(helmet);

  app.setErrorHandler(errorHandler);

  app.get("/", async () => ({
    ok: true,
    service: env.APP_NAME,
    version: env.APP_VERSION,
  }));

  await app.register(registerRoutes, { prefix: env.API_PREFIX });
  createSocketManager(app);

  return app;
}
