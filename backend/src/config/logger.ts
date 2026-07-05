import pino from "pino";
import type { AppEnv } from "../types/env.js";

export function createLogger(env: AppEnv) {
  return pino({
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === "development"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          }
        : undefined,
  });
}
