import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().default("CubeRanked"),
  APP_VERSION: z.string().default("0.1.0"),
  APP_PORT: z.coerce.number().int().positive().default(4000),
  APP_HOST: z.string().default("0.0.0.0"),
  API_PREFIX: z.string().default("/api/v1"),
  FRONTEND_ORIGIN: z.string().optional().default("http://127.0.0.1:5173,http://localhost:5173"),
  FRONTEND_CORS_ALLOW_ANY: z
    .string()
    .optional()
    .transform((val) => val === "true" || val === "1"),
  SOCKET_PATH: z.string().optional().default("/v1"),
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  AUTH_JWT_SECRET: z.string().min(16).default("dev-only-cuberanked-secret-change-me"),
  AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  AUTH_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  AUTH_STORE_PATH: z.string().min(1).default("data/auth-store.json"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
}).superRefine((env, context) => {
  if (env.NODE_ENV === "production" && env.AUTH_JWT_SECRET === "dev-only-cuberanked-secret-change-me") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["AUTH_JWT_SECRET"],
      message: "AUTH_JWT_SECRET must be configured in production",
    });
  }
});

export type AppEnv = z.infer<typeof envSchema>;
