import { randomUUID } from "node:crypto";
import type { AppEnv } from "../types/env.js";
import { AuthenticationError, ValidationError } from "../utils/errors.js";
import { verifySupabaseToken, type SupabaseUserInfo } from "./supabase.js";
import { UserStore, type StoredSettings, type StoredStatistics, type StoredUser } from "../users/user-store.js";

export interface PublicUserProfile {
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
  settings: StoredSettings;
  statistics: StoredStatistics;
  rating?: number;
  peakRating?: number;
  streak?: number;
  seasonRating?: number;
}

export class AuthService {
  constructor(
    private readonly env: AppEnv,
    private readonly store: UserStore,
  ) {}

  async authenticate(supabaseToken: string): Promise<{ userId: string; tokenId: string }> {
    const supabaseUser = await verifySupabaseToken(this.env, supabaseToken);
    if (!supabaseUser) {
      throw new AuthenticationError("Invalid or expired token");
    }

    const meta = supabaseUser.userMetadata;
    const googleName =
      (typeof meta.full_name === "string" && meta.full_name.trim()) ||
      (typeof meta.name === "string" && meta.name.trim()) ||
      supabaseUser.email.split("@")[0] ||
      "Player";
    const googleAvatar =
      (typeof meta.avatar_url === "string" && meta.avatar_url.trim()) ||
      (typeof meta.picture === "string" && meta.picture.trim()) ||
      null;

    const localUser = await this.store.findOrCreateUserFromSupabase({
      supabaseId: supabaseUser.sub,
      email: supabaseUser.email,
      username: googleName,
      avatar: googleAvatar,
      googleUsername: googleName,
      googleAvatar: googleAvatar ?? undefined,
    });

    return { userId: localUser.id, tokenId: supabaseUser.sub };
  }

  async getProfile(userId: string): Promise<PublicUserProfile> {
    const user = await this.store.findUserById(userId);
    if (!user) {
      throw new AuthenticationError("User not found");
    }

    return toPublicProfile(user);
  }

  async updateProfile(userId: string, patch: {
    username?: string;
    avatar?: string | null;
    country?: string | null;
    bio?: string;
    theme?: "dark" | "light";
    favoriteMode?: string;
  }): Promise<PublicUserProfile> {
    if (patch.username) {
      const existing = await this.store.findUserByUsername(patch.username);
      if (existing && existing.id !== userId) {
        throw new ValidationError("Username is already taken");
      }
    }

    const user = await this.store.updateUser(userId, patch);
    if (!user) {
      throw new AuthenticationError("User not found");
    }

    return toPublicProfile(user);
  }

  async updateSettings(userId: string, settings: Partial<StoredSettings>): Promise<PublicUserProfile> {
    const user = await this.store.updateSettings(userId, settings);
    if (!user) {
      throw new AuthenticationError("User not found");
    }

    return toPublicProfile(user);
  }

  async updateStatistics(userId: string, statistics: Partial<StoredStatistics>): Promise<PublicUserProfile> {
    const user = await this.store.updateStatistics(userId, statistics);
    if (!user) {
      throw new AuthenticationError("User not found");
    }

    return toPublicProfile(user);
  }
}

export function createGuestProfile() {
  const username = `Guest${Math.floor(1_000 + Math.random() * 9_000)}`;
  return {
    id: randomUUID(),
    username,
    email: "",
    avatar: null,
    country: null,
    bio: "",
    theme: "dark" as const,
    favoriteMode: "Practice",
    status: "online" as const,
    joinDate: new Date().toISOString(),
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    botWins: 0,
    botLosses: 0,
    bestTimeMs: null,
    averageTimeMs: null,
    settings: null,
    statistics: null,
    rating: 1200,
    peakRating: 1200,
    streak: 0,
    seasonRating: 1200,
  };
}

function toPublicProfile(user: StoredUser): PublicUserProfile {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    country: user.country,
    bio: user.bio,
    theme: user.theme,
    favoriteMode: user.favoriteMode,
    status: user.status,
    joinDate: user.createdAt,
    gamesPlayed: user.statistics.gamesPlayed,
    wins: user.statistics.wins,
    losses: user.statistics.losses,
    botWins: user.statistics.botWins,
    botLosses: user.statistics.botLosses,
    bestTimeMs: user.statistics.bestTimeMs,
    averageTimeMs: user.statistics.averageTimeMs,
    settings: user.settings,
    statistics: user.statistics,
    rating: user.rating ?? 1200,
    peakRating: user.peakRating ?? 1200,
    streak: user.streak ?? 0,
    seasonRating: user.seasonRating ?? 1200,
  };
}
