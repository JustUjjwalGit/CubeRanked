import pino from "pino";
import type { AppEnv } from "../types/env.js";

export function createLogger(env: AppEnv) {
  if (env.NODE_ENV === "development") {
    return {
      level: env.LOG_LEVEL,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    };
  }
  return {
    level: env.LOG_LEVEL,
  };
}
