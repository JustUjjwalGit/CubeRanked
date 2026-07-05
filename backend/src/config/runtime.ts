import type { AppEnv } from "../types/env.js";

export interface RuntimeContext {
  env: AppEnv;
  startedAt: number;
}
