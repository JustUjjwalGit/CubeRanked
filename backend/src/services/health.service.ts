export interface HealthStatus {
  server: "ok";
  database: "not_configured";
  redis: "not_configured";
  version: string;
  uptime: number;
  timestamp: string;
}

export function buildHealthStatus(version: string, startedAt: number): HealthStatus {
  return {
    server: "ok",
    database: "not_configured",
    redis: "not_configured",
    version,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  };
}
