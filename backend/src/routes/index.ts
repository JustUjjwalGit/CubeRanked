import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health.js";
import { registerAuthRoutes } from "./auth.js";

export async function registerRoutes(app: FastifyInstance) {
  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
}
