import type { FastifyInstance } from "fastify";
import { getHealthController } from "../controllers/health.controller.js";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", getHealthController);
}
