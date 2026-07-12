import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().default("CubeRanked"),
  APP_VERSION: z.string().default("0.1.0"),
  APP_PORT: z.coerce.number().int().positive().default(4000),
  APP_HOST: z.string().default("0.0.0.0"),
  API_PREFIX: z.string().default("/api/v1"),
  FRONTEND_URL: z.string().optional().default("http://127.0.0.1:8000"),
  FRONTEND_ORIGIN: z.string().optional().default("http://127.0.0.1:8000,http://localhost:8000"),
  FRONTEND_CORS_ALLOW_ANY: z
    .string()
    .optional()
    .transform((val) => val === "true" || val === "1"),
  SOCKET_PATH: z.string().optional().default("/v1"),
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  AUTH_STORE_PATH: z.string().min(1).default("data/auth-store.json"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  SUPABASE_URL: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;
