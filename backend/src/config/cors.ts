import type { AppEnv } from "../types/env.js";
import { isDevelopment } from "./runtime.js";

export function buildCorsOrigins(env: AppEnv): true | Array<string | RegExp> {
  if (isDevelopment(env) && env.FRONTEND_CORS_ALLOW_ANY) {
    return true;
  }

  const configured = env.FRONTEND_ORIGIN
    ? env.FRONTEND_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [];

  if (!isDevelopment(env)) {
    return configured;
  }

  return [
    ...configured,
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://0.0.0.0:8000",
    /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:8000$/,
    /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:8000$/,
    /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}:8000$/,
    /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/,
  ];
}
