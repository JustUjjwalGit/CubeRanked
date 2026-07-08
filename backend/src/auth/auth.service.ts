import { randomUUID } from "node:crypto";
import type { AppEnv } from "../types/env.js";
import { AuthenticationError, ValidationError } from "../utils/errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import { signAccessToken, verifyAccessToken } from "./jwt.js";
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

export interface AuthSession {
  user: PublicUserProfile;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

export class AuthService {
  constructor(
    private readonly env: AppEnv,
    private readonly store: UserStore,
  ) {}

  async register(input: {
    username: string;
    email: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<AuthSession> {
    if (await this.store.findUserByEmail(input.email)) {
      throw new ValidationError("Email is already registered");
    }

    if (await this.store.findUserByUsername(input.username)) {
      throw new ValidationError("Username is already taken");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.store.createUser({
      username: input.username,
      email: input.email,
      passwordHash,
    });

    return this.createSession(user, input.rememberMe);
  }

  async login(input: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<AuthSession> {
    const user = await this.store.findUserByEmail(input.email);

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new AuthenticationError("Invalid email or password");
    }

    await this.store.updateUser(user.id, { status: "online" });
    return this.createSession({ ...user, status: "online" }, input.rememberMe);
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const record = await this.store.findRefreshToken(refreshToken);

    if (!record || record.revokedAt || new Date(record.expiresAt).getTime() <= Date.now()) {
      throw new AuthenticationError("Invalid refresh token");
    }

    const user = await this.store.findUserById(record.userId);
    if (!user) {
      throw new AuthenticationError("Invalid refresh token");
    }

    await this.store.revokeRefreshToken(refreshToken);
    return this.createSession(user, true);
  }

  async logout(refreshToken: string | null, userId?: string): Promise<void> {
    if (refreshToken) {
      await this.store.revokeRefreshToken(refreshToken);
    }

    if (userId) {
      await this.store.updateUser(userId, { status: "offline" });
    }
  }

  async authenticate(accessToken: string): Promise<{ userId: string; tokenId: string }> {
    const payload = verifyAccessToken(accessToken, this.env.AUTH_JWT_SECRET);
    const user = await this.store.findUserById(payload.sub);

    if (!user) {
      throw new AuthenticationError("User not found");
    }

    return { userId: payload.sub, tokenId: payload.jti };
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

  getOAuthProvider(provider: string) {
    const normalized = provider.toLowerCase();
    const supported = ["google", "github", "discord"];

    if (!supported.includes(normalized)) {
      throw new ValidationError("Unsupported OAuth provider");
    }

    if (normalized === "google") {
      const clientId = this.env.GOOGLE_CLIENT_ID;
      const redirectUri = this.env.GOOGLE_REDIRECT_URI;

      if (!clientId || !redirectUri) {
        return { provider: normalized, configured: false, authorizationUrl: null };
      }

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        access_type: "offline",
        prompt: "select_account",
      });

      return {
        provider: normalized,
        configured: true,
        authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      };
    }

    return { provider: normalized, configured: false, authorizationUrl: null };
  }

  async handleGoogleCallback(code: string): Promise<AuthSession> {
    const clientId = this.env.GOOGLE_CLIENT_ID;
    const clientSecret = this.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = this.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ValidationError("Google OAuth is not configured");
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      throw new AuthenticationError("Failed to exchange Google authorization code");
    }

    const tokenData = await tokenRes.json() as { access_token?: string; id_token?: string };
    if (!tokenData.access_token) {
      throw new AuthenticationError("No access token from Google");
    }

    // Fetch user info from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoRes.ok) {
      throw new AuthenticationError("Failed to fetch Google user info");
    }

    const googleUser = await userInfoRes.json() as {
      id: string;
      email: string;
      name: string;
      picture?: string;
      verified_email?: boolean;
    };

    // Find or create user
    let user = await this.store.findUserByGoogleId(googleUser.id);

    if (!user) {
      // Check if email already exists (link accounts)
      const existing = await this.store.findUserByEmail(googleUser.email);
      if (existing) {
        user = await this.store.linkGoogleAccount(existing.id, googleUser.id, googleUser.picture ?? null) ?? existing;
      } else {
        // Generate unique username from Google display name
        const baseName = googleUser.name
          .replace(/[^a-zA-Z0-9]/g, "")
          .slice(0, 18)
          || "Player";
        let username = baseName;
        let attempt = 0;
        while (await this.store.findUserByUsername(username)) {
          attempt++;
          username = `${baseName}${attempt}`;
        }

        user = await this.store.createGoogleUser({
          googleId: googleUser.id,
          email: googleUser.email,
          username,
          avatar: googleUser.picture ?? null,
        });
      }
    }

    return this.createSession(user, true);
  }

  private async createSession(user: StoredUser, rememberMe = false): Promise<AuthSession> {
    const access = signAccessToken({
      userId: user.id,
      secret: this.env.AUTH_JWT_SECRET,
      ttlSeconds: this.env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    });
    const refreshTtlDays = rememberMe ? this.env.AUTH_REFRESH_TOKEN_TTL_DAYS : 1;
    const refresh = await this.store.createRefreshToken(user.id, refreshTtlDays);

    return {
      user: toPublicProfile(user),
      accessToken: access.token,
      refreshToken: refresh.token,
      accessTokenExpiresAt: access.expiresAt,
    };
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
