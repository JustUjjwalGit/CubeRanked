import type { AppEnv } from "./env.js";

declare module "fastify" {
  interface FastifyInstance {
    env: AppEnv;
    startedAt: number;
  }

  interface FastifyRequest {
    auth?: {
      userId: string;
      tokenId: string;
    };
  }
}
