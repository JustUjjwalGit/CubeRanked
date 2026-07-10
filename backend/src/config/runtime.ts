import type { AppEnv } from "../types/env.js";

export interface RuntimeContext {
  env: AppEnv;
  startedAt: number;
}

export function isDevelopment(env: AppEnv): boolean {
  return env.NODE_ENV === "development" || env.NODE_ENV === "test";
}

export function isProduction(env: AppEnv): boolean {
  return env.NODE_ENV === "production";
}
