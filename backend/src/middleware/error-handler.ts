import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError, InternalServerError, ValidationError } from "../utils/errors.js";
import { errorResponse } from "../utils/response.js";

export function errorHandler(error: FastifyError, _request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ZodError) {
    const appError = new ValidationError("Validation failed", error.flatten());
    return reply.status(appError.statusCode).send(errorResponse(appError.code, appError.message, appError.details));
  }

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.code, error.message, error.details));
  }

  const appError = new InternalServerError(error.message);
  return reply.status(appError.statusCode).send(errorResponse(appError.code, appError.message));
}
