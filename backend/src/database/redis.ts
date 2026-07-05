import Redis from "ioredis";
import type { AppEnv } from "../types/env.js";

export function createRedisClient(env: AppEnv): Redis {
  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is not configured");
  }

  return new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
}
