import type Redis from "ioredis";

export class RedisService {
  constructor(private readonly client: Redis) {}

  async healthcheck(): Promise<"ok" | "degraded"> {
    try {
      await this.client.ping();
      return "ok";
    } catch {
      return "degraded";
    }
  }

  get clientInstance(): Redis {
    return this.client;
  }
}
