import type { AppEnv } from "../types/env.js";

export function buildCorsOrigins(env: AppEnv): string[] {
  const configured = env.FRONTEND_ORIGIN
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (env.NODE_ENV !== "development") {
    return configured;
  }

  return Array.from(new Set([
    ...configured,
    "http://127.0.0.1:5173",
    "http://localhost:5173",
  ]));
}
