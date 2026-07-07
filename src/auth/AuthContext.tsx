import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  clearSessionTokens,
  fetchProfile,
  getOAuthProvider,
  getStoredTokens,
  loginAccount,
  logoutAccount,
  refreshSession,
  registerAccount,
  saveCloudSettings,
  saveCloudStatistics,
  updateProfile as updateCloudProfile,
  type UserProfile,
  type UserStatistics,
} from "../lib/authApi";
import type { SessionSettings } from "../lib/sessionStats";

type AuthMode = "loading" | "guest" | "authenticated";

interface AuthContextValue {
  mode: AuthMode;
  user: UserProfile | null;
  error: string | null;
  login: (input: { email: string; password: string; rememberMe: boolean }) => Promise<void>;
  register: (input: { username: string; email: string; password: string; rememberMe: boolean }) => Promise<void>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<UserProfile, "username" | "avatar" | "country" | "bio" | "theme" | "favoriteMode">>) => Promise<void>;
  syncSettings: (settings: SessionSettings) => Promise<void>;
  syncStatistics: (statistics: UserStatistics) => Promise<void>;
  startOAuth: (provider: "google" | "github" | "discord") => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode>("loading");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const boot = async () => {
      const tokens = getStoredTokens();
      if (!tokens.refreshToken) {
        if (active) setMode("guest");
        return;
      }

      const session = await refreshSession();
      if (!active) return;

      if (session) {
        setUser(session.user);
        setMode("authenticated");
      } else {
        setMode("guest");
      }
    };

    void boot();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (input: { email: string; password: string; rememberMe: boolean }) => {
    setError(null);
    const session = await loginAccount(input);
    setUser(session.user);
    setMode("authenticated");
  }, []);

  const register = useCallback(async (input: { username: string; email: string; password: string; rememberMe: boolean }) => {
    setError(null);
    const session = await registerAccount(input);
    setUser(session.user);
    setMode("authenticated");
  }, []);

  const continueAsGuest = useCallback(() => {
    clearSessionTokens();
    setUser(null);
    setMode("guest");
    setError(null);
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    await logoutAccount();
    setUser(null);
    setMode("guest");
  }, []);

  const updateProfile = useCallback(async (patch: Partial<Pick<UserProfile, "username" | "avatar" | "country" | "bio" | "theme" | "favoriteMode">>) => {
    if (mode !== "authenticated") return;
    setError(null);
    const profile = await updateCloudProfile(patch);
    setUser(profile);
  }, [mode]);

  const syncSettings = useCallback(async (settings: SessionSettings) => {
    if (mode !== "authenticated") return;
    const saved = await saveCloudSettings(settings);
    setUser((current) => current ? { ...current, settings: saved, theme: saved.theme } : current);
  }, [mode]);

  const syncStatistics = useCallback(async (statistics: UserStatistics) => {
    if (mode !== "authenticated") return;
    const saved = await saveCloudStatistics(statistics);
    setUser((current) => current ? {
      ...current,
      statistics: saved,
      gamesPlayed: saved.gamesPlayed,
      wins: saved.wins,
      losses: saved.losses,
      botWins: saved.botWins,
      botLosses: saved.botLosses,
      bestTimeMs: saved.bestTimeMs,
      averageTimeMs: saved.averageTimeMs,
    } : current);
  }, [mode]);

  const startOAuth = useCallback(async (provider: "google" | "github" | "discord") => {
    const oauth = await getOAuthProvider(provider);
    if (oauth.configured && oauth.authorizationUrl) {
      window.location.href = oauth.authorizationUrl;
      return;
    }

    setError(`${provider[0].toUpperCase()}${provider.slice(1)} login is prepared but not configured yet.`);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (mode !== "authenticated") return;

    let active = true;
    const refresh = async () => {
      try {
        const profile = await fetchProfile();
        if (active) setUser(profile);
      } catch {
        if (active) {
          clearSessionTokens();
          setUser(null);
          setMode("guest");
        }
      }
    };

    void refresh();
    return () => {
      active = false;
    };
  }, [mode]);

  const value = useMemo<AuthContextValue>(() => ({
    mode,
    user,
    error,
    login,
    register,
    continueAsGuest,
    logout,
    updateProfile,
    syncSettings,
    syncStatistics,
    startOAuth,
    clearError,
  }), [
    mode,
    user,
    error,
    login,
    register,
    continueAsGuest,
    logout,
    updateProfile,
    syncSettings,
    syncStatistics,
    startOAuth,
    clearError,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
