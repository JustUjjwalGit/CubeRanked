import type { AchievementsData, AchievementCheckResult, AchievementEvent } from "../features/achievements/achievement.types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? `http://${window.location.hostname}:4000/api/v1`;
const ACCESS_TOKEN_KEY = "cuberanked.auth.accessToken";

function getToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  const payload = await res.json();
  if (!res.ok || !payload.ok) {
    throw new Error(payload.error?.message ?? "Request failed");
  }
  return payload.data;
}

export async function fetchAchievements(): Promise<AchievementsData> {
  return authFetch<AchievementsData>("/achievements");
}

export async function sendAchievementEvent(
  event: AchievementEvent
): Promise<AchievementCheckResult> {
  return authFetch<AchievementCheckResult>("/achievements/event", {
    method: "POST",
    body: JSON.stringify({ type: event.type, data: event.data }),
    headers: { "Content-Type": "application/json" },
  });
}
