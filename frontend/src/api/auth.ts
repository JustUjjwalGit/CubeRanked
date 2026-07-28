import type { SessionSettings, SolveRecord } from "../utils/sessionStats";
import { API_URL } from "../config";

const apiBaseUrl = API_URL;

export interface UserStatistics {
  gamesPlayed: number;
  wins: number;
  losses: number;
  botWins: number;
  botLosses: number;
  bestTimeMs: number | null;
  averageTimeMs: number | null;
  practiceHistory: SolveRecord[];
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  country: string | null;
  bio: string;
  theme: "dark" | "light";
  favoriteMode: string;
  status: "online" | "offline";
  joinDate: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  botWins: number;
  botLosses: number;
  bestTimeMs: number | null;
  averageTimeMs: number | null;
  settings: SessionSettings;
  statistics: UserStatistics;
  rating?: number;
  peakRating?: number;
  peakElo?: number;
  streak?: number;
  seasonRating?: number;
  seasonPeak?: number;
  globalPeak?: number;
  winRate?: number;
  glicko?: {
    rating: number;
    rd: number;
    vol: number;
  };
  placementMatchesPlayed?: number;
}

interface ApiSuccess<T> {
  ok: true;
  data: T;
}

interface ApiFailure {
  ok: false;
  error: { message: string };
}

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export async function fetchProfile(accessToken: string): Promise<UserProfile> {
  return authorizedRequest<UserProfile>("/profile/me", { accessToken });
}

export async function updateProfile(accessToken: string, input: Partial<Pick<UserProfile, "username" | "avatar" | "country" | "bio" | "theme" | "favoriteMode">>): Promise<UserProfile> {
  return authorizedRequest<UserProfile>("/profile/me", {
    method: "PATCH",
    body: input,
    accessToken,
  });
}

export async function saveCloudSettings(accessToken: string, settings: SessionSettings): Promise<SessionSettings> {
  return authorizedRequest<SessionSettings>("/settings/me", {
    method: "PUT",
    body: settings,
    accessToken,
  });
}

export async function saveCloudStatistics(accessToken: string, statistics: UserStatistics): Promise<UserStatistics> {
  return authorizedRequest<UserStatistics>("/statistics/me", {
    method: "PUT",
    body: statistics,
    accessToken,
  });
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  accessToken: string;
}

async function authorizedRequest<T>(path: string, options: RequestOptions): Promise<T> {
  return request<T>(path, options);
}

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "Request failed" : payload.error.message);
  }

  return payload.data;
}
