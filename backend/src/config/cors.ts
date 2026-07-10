import type { AppEnv } from "../types/env.js";
import { isDevelopment } from "./runtime.js";

export function buildCorsOrigins(env: AppEnv): true | string[] {
  if (isDevelopment(env) && env.FRONTEND_CORS_ALLOW_ANY) {
    return true;
  }

  const configured = env.FRONTEND_ORIGIN
    ? env.FRONTEND_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [];

  if (isDevelopment(env)) {
    return Array.from(new Set([
      ...configured,
      "http://127.0.0.1:5173",
      "http://localhost:5173",
    ]));
  }

  return configured;
}
