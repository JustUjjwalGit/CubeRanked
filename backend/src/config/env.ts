import { envSchema, type AppEnv } from "../types/env.js";

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
