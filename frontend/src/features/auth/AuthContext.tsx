import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import {
  fetchProfile,
  saveCloudSettings,
  saveCloudStatistics,
  updateProfile as updateCloudProfile,
  type UserProfile,
  type UserStatistics,
} from "../../api/auth";
import type { SessionSettings } from "../../utils/sessionStats";

const GUEST_USERNAME_KEY = "cuberanked.guest.username";
const FIRST_VISIT_KEY = "cuberanked.firstVisit";

type AuthMode = "loading" | "guest" | "authenticated";

function generateGuestUsername(): string {
  const suffix = String(Math.floor(1_000 + Math.random() * 9_000));
  return `Guest-${suffix}`;
}

function getOrCreateGuestUsername(): string {
  const stored = localStorage.getItem(GUEST_USERNAME_KEY);
  if (stored) return stored;
  const name = generateGuestUsername();
  localStorage.setItem(GUEST_USERNAME_KEY, name);
  return name;
}

interface AuthContextValue {
  mode: AuthMode;
  user: UserProfile | null;
  error: string | null;
  guestUsername: string;
  isFirstVisit: boolean;
  supabaseUser: User | null;
  supabaseAccessToken: string | null;
  loginWithGoogle: () => Promise<void>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<UserProfile, "username" | "avatar" | "country" | "bio" | "theme" | "favoriteMode">>) => Promise<void>;
  syncSettings: (settings: SessionSettings) => Promise<void>;
  syncStatistics: (statistics: UserStatistics) => Promise<void>;
  clearError: () => void;
  dismissFirstVisit: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode>("loading");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guestUsername] = useState<string>(getOrCreateGuestUsername);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [supabaseAccessToken, setSupabaseAccessToken] = useState<string | null>(null);
  const [isFirstVisit, setIsFirstVisit] = useState(() => {
    return !localStorage.getItem(FIRST_VISIT_KEY);
  });

  const dismissFirstVisit = useCallback(() => {
    localStorage.setItem(FIRST_VISIT_KEY, "1");
    setIsFirstVisit(false);
  }, []);

  // Boot: restore Supabase session
  useEffect(() => {
    let active = true;

    const boot = async () => {
      console.log("[OAuth DEBUG] Boot: calling supabase.auth.getSession()");
      const sbKeysBoot: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("sb-")) sbKeysBoot.push(key);
      }
      console.log("[OAuth DEBUG] Boot: localStorage sb-* keys:", sbKeysBoot);

      const { data: { session } } = await supabase.auth.getSession();
      console.log("[OAuth DEBUG] Boot: getSession result:", session?.access_token ? "session found" : "no session");

      if (session?.access_token) {
        setSupabaseAccessToken(session.access_token);
        setSupabaseUser(session.user);

        try {
          const profile = await fetchProfile(session.access_token);
          if (active) {
            setUser(profile);
            setMode("authenticated");
          }
        } catch {
          // Token valid but profile fetch failed — fall to guest
          if (active) setMode("guest");
        }
      } else {
        if (active) setMode("guest");
      }
    };

    void boot();
    return () => { active = false; };
  }, []);

  // Listen for Supabase auth state changes
  useEffect(() => {
    console.log("[OAuth DEBUG] Registering onAuthStateChange listener");
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[OAuth DEBUG] onAuthStateChange event:", event, "session:", session?.access_token ? "present" : "null");

      if (event === "SIGNED_IN" && session?.access_token) {
        setSupabaseAccessToken(session.access_token);
        setSupabaseUser(session.user);

        try {
          const profile = await fetchProfile(session.access_token);
          setUser(profile);
          setMode("authenticated");
        } catch {
          setError("Failed to load profile after sign in");
          setMode("guest");
        }
      } else if (event === "SIGNED_OUT") {
        setSupabaseAccessToken(null);
        setSupabaseUser(null);
        setUser(null);
        setMode("guest");
      } else if (event === "TOKEN_REFRESHED" && session?.access_token) {
        setSupabaseAccessToken(session.access_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setError(null);

    // DEBUG: log origin and Supabase storage keys before OAuth
    console.log("[OAuth DEBUG] window.location.origin:", window.location.origin);
    const sbKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("sb-")) sbKeys.push(key);
    }
    console.log("[OAuth DEBUG] localStorage sb-* keys:", sbKeys);
    sbKeys.forEach((k) => {
      try {
        console.log(`[OAuth DEBUG] ${k}:`, JSON.parse(localStorage.getItem(k) ?? "null"));
      } catch {
        console.log(`[OAuth DEBUG] ${k}:`, localStorage.getItem(k));
      }
    });

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
    });

    if (oauthError) {
      console.error("[OAuth DEBUG] signInWithOAuth error:", oauthError);
      setError(oauthError.message);
    }
  }, []);

  const continueAsGuest = useCallback(() => {
    setUser(null);
    setMode("guest");
    setError(null);
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    console.log("[OAuth DEBUG] Logout: calling supabase.auth.signOut()");
    const sbKeysBefore: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("sb-")) sbKeysBefore.push(key);
    }
    console.log("[OAuth DEBUG] Logout: sb-* keys before signOut:", sbKeysBefore);
    await supabase.auth.signOut();
    const sbKeysAfter: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("sb-")) sbKeysAfter.push(key);
    }
    console.log("[OAuth DEBUG] Logout: sb-* keys after signOut:", sbKeysAfter);
    setSupabaseAccessToken(null);
    setSupabaseUser(null);
    setUser(null);
    setMode("guest");
  }, []);

  const refreshProfile = useCallback(async () => {
    if (mode !== "authenticated" || !supabaseAccessToken) return;
    try {
      const profile = await fetchProfile(supabaseAccessToken);
      setUser(profile);
    } catch (e) {
      console.error("Failed to refresh profile", e);
    }
  }, [mode, supabaseAccessToken]);

  const updateProfile = useCallback(async (patch: Partial<Pick<UserProfile, "username" | "avatar" | "country" | "bio" | "theme" | "favoriteMode">>) => {
    if (mode !== "authenticated" || !supabaseAccessToken) return;
    setError(null);
    const profile = await updateCloudProfile(supabaseAccessToken, patch);
    setUser(profile);
  }, [mode, supabaseAccessToken]);

  const syncSettings = useCallback(async (settings: SessionSettings) => {
    if (mode !== "authenticated" || !supabaseAccessToken) return;
    const saved = await saveCloudSettings(supabaseAccessToken, settings);
    setUser((current) => current ? { ...current, settings: saved, theme: saved.theme } : current);
  }, [mode, supabaseAccessToken]);

  const syncStatistics = useCallback(async (statistics: UserStatistics) => {
    if (mode !== "authenticated" || !supabaseAccessToken) return;
    const saved = await saveCloudStatistics(supabaseAccessToken, statistics);
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
  }, [mode, supabaseAccessToken]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(() => ({
    mode,
    user,
    error,
    guestUsername,
    isFirstVisit,
    supabaseUser,
    supabaseAccessToken,
    loginWithGoogle,
    continueAsGuest,
    logout,
    refreshProfile,
    updateProfile,
    syncSettings,
    syncStatistics,
    clearError,
    dismissFirstVisit,
  }), [
    mode,
    user,
    error,
    guestUsername,
    isFirstVisit,
    supabaseUser,
    supabaseAccessToken,
    loginWithGoogle,
    continueAsGuest,
    logout,
    refreshProfile,
    updateProfile,
    syncSettings,
    syncStatistics,
    clearError,
    dismissFirstVisit,
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
