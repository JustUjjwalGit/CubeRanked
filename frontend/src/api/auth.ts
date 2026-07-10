import type { ApiFailure } from "./client";
import type { SessionSettings, SolveRecord } from "../utils/sessionStats";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? `http://${window.location.hostname}:4000/api/v1`;
const ACCESS_TOKEN_KEY = "cuberanked.auth.accessToken";
const REFRESH_TOKEN_KEY = "cuberanked.auth.refreshToken";
const EXPIRES_AT_KEY = "cuberanked.auth.accessTokenExpiresAt";

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
  streak?: number;
  seasonRating?: number;
  glicko?: {
    rating: number;
    rd: number;
    vol: number;
  };
  placementMatchesPlayed?: number;
}

export interface AuthSession {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

interface ApiSuccess<T> {
  ok: true;
  data: T;
}

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function getStoredTokens() {
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
    accessTokenExpiresAt: localStorage.getItem(EXPIRES_AT_KEY),
  };
}

export function storeSessionTokens(session: AuthSession) {
  localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  localStorage.setItem(EXPIRES_AT_KEY, session.accessTokenExpiresAt);
}

export function clearSessionTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
}

/**
 * Called on app startup to check if the URL contains an OAuth session or error
 * from the server callback redirect. Clears the URL params after consuming them.
 * Returns 'session' if tokens were stored, 'error' if there was an error, or null.
 */
export function consumeOAuthRedirect(): { type: "session" } | { type: "error"; message: string } | null {
  const params = new URLSearchParams(window.location.search);
  const sessionParam = params.get("oauth_session");
  const errorParam = params.get("oauth_error");

  if (sessionParam || errorParam) {
    // Clean the URL immediately
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  if (sessionParam) {
    try {
      const sessionParams = new URLSearchParams(decodeURIComponent(sessionParam));
      const accessToken = sessionParams.get("accessToken");
      const refreshToken = sessionParams.get("refreshToken");
      const accessTokenExpiresAt = sessionParams.get("accessTokenExpiresAt");
      if (accessToken && refreshToken && accessTokenExpiresAt) {
        storeSessionTokens({ accessToken, refreshToken, accessTokenExpiresAt } as AuthSession);
        return { type: "session" };
      }
    } catch {
      // fall through
    }
  }

  if (errorParam) {
    return { type: "error", message: decodeURIComponent(errorParam) };
  }

  return null;
}

export async function registerAccount(input: {
  username: string;
  email: string;
  password: string;
  rememberMe: boolean;
}): Promise<AuthSession> {
  const session = await request<AuthSession>("/auth/register", {
    method: "POST",
    body: input,
  });
  storeSessionTokens(session);
  return session;
}

export async function loginAccount(input: {
  email: string;
  password: string;
  rememberMe: boolean;
}): Promise<AuthSession> {
  const session = await request<AuthSession>("/auth/login", {
    method: "POST",
    body: input,
  });
  storeSessionTokens(session);
  return session;
}

export async function refreshSession(): Promise<AuthSession | null> {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) return null;

  try {
    const session = await request<AuthSession>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
      skipAuth: true,
    });
    storeSessionTokens(session);
    return session;
  } catch {
    clearSessionTokens();
    return null;
  }
}

export async function logoutAccount() {
  const { refreshToken } = getStoredTokens();

  try {
    await authorizedRequest<{ loggedOut: true }>("/auth/logout", {
      method: "POST",
      body: { refreshToken },
    });
  } finally {
    clearSessionTokens();
  }
}

export async function fetchProfile(): Promise<UserProfile> {
  return authorizedRequest<UserProfile>("/profile/me");
}

export async function updateProfile(input: Partial<Pick<UserProfile, "username" | "avatar" | "country" | "bio" | "theme" | "favoriteMode">>): Promise<UserProfile> {
  return authorizedRequest<UserProfile>("/profile/me", {
    method: "PATCH",
    body: input,
  });
}

export async function saveCloudSettings(settings: SessionSettings): Promise<SessionSettings> {
  return authorizedRequest<SessionSettings>("/settings/me", {
    method: "PUT",
    body: settings,
  });
}

export async function saveCloudStatistics(statistics: UserStatistics): Promise<UserStatistics> {
  return authorizedRequest<UserStatistics>("/statistics/me", {
    method: "PUT",
    body: statistics,
  });
}

export async function getOAuthProvider(provider: "google" | "github" | "discord") {
  return request<{ provider: string; configured: boolean; authorizationUrl: string | null }>(`/auth/oauth/${provider}`);
}

async function authorizedRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let tokens = getStoredTokens();

  if (!tokens.accessToken || isExpiring(tokens.accessTokenExpiresAt)) {
    await refreshSession();
    tokens = getStoredTokens();
  }

  return request<T>(path, {
    ...options,
    accessToken: tokens.accessToken ?? undefined,
  });
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  accessToken?: string;
  skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.accessToken && !options.skipAuth) {
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

function isExpiring(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() - Date.now() < 30_000;
}
