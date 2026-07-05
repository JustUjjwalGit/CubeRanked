import type { FastifyReply, FastifyRequest } from "fastify";
import { buildHealthStatus } from "../services/health.service.js";
import { successResponse } from "../utils/response.js";

export async function getHealthController(request: FastifyRequest, reply: FastifyReply) {
  const status = buildHealthStatus(
    request.server.env.APP_VERSION,
    request.server.startedAt,
  );

  return reply.status(200).send(successResponse(status));
}
