export type HealthState = "connecting" | "connected" | "offline";

export interface ApiHealthResponse {
  ok: boolean;
  data: {
    server: "ok";
    database: "ok" | "degraded" | "not_configured";
    redis: "ok" | "degraded" | "not_configured";
    version: string;
    uptime: number;
    timestamp: string;
  };
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4000/api/v1";

export async function fetchHealth(signal?: AbortSignal): Promise<ApiHealthResponse["data"]> {
  const response = await fetch(`${apiBaseUrl}/health`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  const payload = (await response.json()) as ApiHealthResponse;

  if (!response.ok || !payload.ok) {
    throw new Error("Health check failed");
  }

  return payload.data;
}
