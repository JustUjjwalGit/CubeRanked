import type { ApiFailure, ApiSuccess } from "../types/api.js";

export function successResponse<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

export function errorResponse(code: string, message: string, details?: unknown): ApiFailure {
  return { ok: false, error: { code, message, details } };
}
