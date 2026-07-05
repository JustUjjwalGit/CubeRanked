import type { FastifyRequest } from "fastify";
import { AuthenticationError } from "../utils/errors.js";
import type { AuthService } from "./auth.service.js";

export function createRequireAuth(authService: AuthService) {
  return async function requireAuth(request: FastifyRequest) {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

    if (!token) {
      throw new AuthenticationError();
    }

    request.auth = await authService.authenticate(token);
  };
}
