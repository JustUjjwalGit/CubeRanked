import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AppEnv } from "../types/env.js";

export interface StoredSettings {
  inspectionEnabled: boolean;
  animationSpeed: number;
  theme: "dark" | "light";
  hudVisible: boolean;
  showKeyboardCheatSheet: boolean;
  keybindings: Record<string, string>;
}

export interface StoredStatistics {
  gamesPlayed: number;
  wins: number;
  losses: number;
  botWins: number;
  botLosses: number;
  bestTimeMs: number | null;
  averageTimeMs: number | null;
  practiceHistory: unknown[];
}

export interface StoredUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  avatar: string | null;
  country: string | null;
  bio: string;
  theme: "dark" | "light";
  favoriteMode: string;
  status: "online" | "offline";
  settings: StoredSettings;
  statistics: StoredStatistics;
  createdAt: string;
  updatedAt: string;
  googleId?: string;
  provider?: "email" | "google";
  rating?: number;
  peakRating?: number;
  glicko?: {
    rating: number;
    rd: number;
    vol: number;
  };
  placementMatchesPlayed?: number;
  streak?: number;
  seasonRating?: number;
  friends?: string[];
  friendRequests?: Array<{ fromId: string; fromUsername: string; fromAvatar: string | null; toId: string; toUsername: string; status: "pending" }>;
  blockedUsers?: string[];
  privacy?: {
    showOnlineStatus: boolean;
    allowFriendRequests: boolean;
    allowSpectators: boolean;
    allowPrivateInvites: boolean;
  };
  recentPlayers?: Array<{ userId: string; username: string; avatar: string | null; playedAt: string }>;
}

export interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

interface StoreData {
  users: StoredUser[];
  refreshTokens: StoredRefreshToken[];
}

const DEFAULT_SETTINGS: StoredSettings = {
  inspectionEnabled: true,
  animationSpeed: 0.24,
  theme: "dark",
  hudVisible: true,
  showKeyboardCheatSheet: true,
  keybindings: {
    U: "U",
    R: "R",
    F: "F",
    D: "D",
    L: "L",
    B: "B",
  },
};

const DEFAULT_STATISTICS: StoredStatistics = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  botWins: 0,
  botLosses: 0,
  bestTimeMs: null,
  averageTimeMs: null,
  practiceHistory: [],
};

export class UserStore {
  private readonly filePath: string;
  private pending = Promise.resolve();

  constructor(env: AppEnv) {
    this.filePath = resolve(process.cwd(), env.AUTH_STORE_PATH);
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const data = await this.read();
    return data.users.find((user) => user.id === id) ?? null;
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const normalizedEmail = normalizeEmail(email);
    const data = await this.read();
    return data.users.find((user) => user.email.toLowerCase() === normalizedEmail) ?? null;
  }

  async findUserByUsername(username: string): Promise<StoredUser | null> {
    const normalizedUsername = username.toLowerCase();
    const data = await this.read();
    return data.users.find((user) => user.username.toLowerCase() === normalizedUsername) ?? null;
  }

  async findUserByGoogleId(googleId: string): Promise<StoredUser | null> {
    const data = await this.read();
    return data.users.find((user) => user.googleId === googleId) ?? null;
  }

  async createUser(input: {
    username: string;
    email: string;
    passwordHash: string;
  }): Promise<StoredUser> {
    return this.write((data) => {
      const now = new Date().toISOString();
      const user: StoredUser = {
        id: randomUUID(),
        username: input.username,
        email: normalizeEmail(input.email),
        passwordHash: input.passwordHash,
        avatar: null,
        country: null,
        bio: "",
        theme: "dark",
        favoriteMode: "Practice",
        status: "online",
        settings: { ...DEFAULT_SETTINGS },
        statistics: { ...DEFAULT_STATISTICS, practiceHistory: [] },
        createdAt: now,
        updatedAt: now,
        rating: 1200,
        peakRating: 1200,
        streak: 0,
        seasonRating: 1200,
        glicko: { rating: 1500, rd: 350, vol: 0.06 },
        placementMatchesPlayed: 0,
        friends: [],
        friendRequests: [],
        blockedUsers: [],
        privacy: {
          showOnlineStatus: true,
          allowFriendRequests: true,
          allowSpectators: true,
          allowPrivateInvites: true,
        },
        recentPlayers: [],
      };

      data.users.push(user);
      return user;
    });
  }

  async createGoogleUser(input: {
    googleId: string;
    email: string;
    username: string;
    avatar: string | null;
  }): Promise<StoredUser> {
    return this.write((data) => {
      const now = new Date().toISOString();
      const user: StoredUser = {
        id: randomUUID(),
        username: input.username,
        email: normalizeEmail(input.email),
        passwordHash: "",
        avatar: input.avatar,
        country: null,
        bio: "",
        theme: "dark",
        favoriteMode: "Practice",
        status: "online",
        settings: { ...DEFAULT_SETTINGS },
        statistics: { ...DEFAULT_STATISTICS, practiceHistory: [] },
        createdAt: now,
        updatedAt: now,
        googleId: input.googleId,
        provider: "google",
        rating: 1200,
        peakRating: 1200,
        streak: 0,
        seasonRating: 1200,
        glicko: { rating: 1500, rd: 350, vol: 0.06 },
        placementMatchesPlayed: 0,
        friends: [],
        friendRequests: [],
        blockedUsers: [],
        privacy: {
          showOnlineStatus: true,
          allowFriendRequests: true,
          allowSpectators: true,
          allowPrivateInvites: true,
        },
        recentPlayers: [],
      };

      data.users.push(user);
      return user;
    });
  }

  async linkGoogleAccount(userId: string, googleId: string, avatar: string | null): Promise<StoredUser | null> {
    return this.write((data) => {
      const user = data.users.find((item) => item.id === userId);
      if (!user) return null;
      user.googleId = googleId;
      user.provider = "google";
      if (avatar && !user.avatar) user.avatar = avatar;
      user.updatedAt = new Date().toISOString();
      return user;
    });
  }

  async updateUser(id: string, patch: Partial<Pick<StoredUser, "username" | "avatar" | "country" | "bio" | "theme" | "favoriteMode" | "status" | "rating" | "glicko" | "placementMatchesPlayed" | "peakRating" | "streak" | "seasonRating">>): Promise<StoredUser | null> {
    return this.write((data) => {
      const user = data.users.find((item) => item.id === id);
      if (!user) return null;

      Object.assign(user, patch, { updatedAt: new Date().toISOString() });
      return user;
    });
  }

  async updateSettings(userId: string, settings: Partial<StoredSettings>): Promise<StoredUser | null> {
    return this.write((data) => {
      const user = data.users.find((item) => item.id === userId);
      if (!user) return null;

      user.settings = { ...user.settings, ...settings };
      user.theme = user.settings.theme;
      user.updatedAt = new Date().toISOString();
      return user;
    });
  }

  async updateStatistics(userId: string, statistics: Partial<StoredStatistics>): Promise<StoredUser | null> {
    return this.write((data) => {
      const user = data.users.find((item) => item.id === userId);
      if (!user) return null;

      user.statistics = { ...user.statistics, ...statistics };
      user.updatedAt = new Date().toISOString();
      return user;
    });
  }

  async createRefreshToken(userId: string, ttlDays: number): Promise<{ token: string; record: StoredRefreshToken }> {
    const token = randomUUID();
    const record: StoredRefreshToken = {
      id: randomUUID(),
      userId,
      tokenHash: hashToken(token),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlDays * 86_400_000).toISOString(),
      revokedAt: null,
    };

    await this.write((data) => {
      data.refreshTokens.push(record);
      return record;
    });

    return { token, record };
  }

  async findRefreshToken(token: string): Promise<StoredRefreshToken | null> {
    const data = await this.read();
    const tokenHash = hashToken(token);
    return data.refreshTokens.find((record) => record.tokenHash === tokenHash) ?? null;
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await this.write((data) => {
      const record = data.refreshTokens.find((item) => item.tokenHash === tokenHash);
      if (record) {
        record.revokedAt = new Date().toISOString();
      }
      return record ?? null;
    });
  }

  async sendFriendRequest(fromId: string, toUsername: string): Promise<{ success: boolean; error?: string; request?: any }> {
    return this.write((data) => {
      const fromUser = data.users.find((u) => u.id === fromId);
      if (!fromUser) return { success: false, error: "Sender not found" };

      const targetUsername = toUsername.toLowerCase().trim();
      const toUser = data.users.find((u) => u.username.toLowerCase() === targetUsername);
      if (!toUser) return { success: false, error: "User not found" };

      if (fromUser.id === toUser.id) {
        return { success: false, error: "You cannot add yourself" };
      }

      // Check if already friends
      if (fromUser.friends?.includes(toUser.id)) {
        return { success: false, error: "Already friends" };
      }

      // Check if blocked
      if (toUser.blockedUsers?.includes(fromUser.id)) {
        return { success: false, error: "You are blocked by this user" };
      }
      if (fromUser.blockedUsers?.includes(toUser.id)) {
        return { success: false, error: "Unblock this user first" };
      }

      // Check if incoming request already exists
      const existingIncoming = fromUser.friendRequests?.find(
        (r) => r.fromId === toUser.id && r.status === "pending"
      );
      if (existingIncoming) {
        // Automatically accept the request!
        if (!fromUser.friends) fromUser.friends = [];
        if (!toUser.friends) toUser.friends = [];
        fromUser.friends.push(toUser.id);
        toUser.friends.push(fromUser.id);
        fromUser.friendRequests = fromUser.friendRequests?.filter((r) => r.fromId !== toUser.id) || [];
        return { success: true, error: "accepted_automatically" };
      }

      // Check if request already sent
      const existingRequest = toUser.friendRequests?.find(
        (r) => r.fromId === fromUser.id && r.status === "pending"
      );
      if (existingRequest) {
        return { success: false, error: "Friend request already sent" };
      }

      // Add pending request
      if (!toUser.friendRequests) toUser.friendRequests = [];
      const newRequest = {
        fromId: fromUser.id,
        fromUsername: fromUser.username,
        fromAvatar: fromUser.avatar,
        toId: toUser.id,
        toUsername: toUser.username,
        status: "pending" as const,
      };
      toUser.friendRequests.push(newRequest);
      return { success: true, request: newRequest };
    });
  }

  async respondFriendRequest(userId: string, fromId: string, accept: boolean): Promise<{ success: boolean; friend?: StoredUser }> {
    return this.write((data) => {
      const user = data.users.find((u) => u.id === userId);
      const friend = data.users.find((u) => u.id === fromId);
      if (!user || !friend) return { success: false };

      // Remove from friend requests
      user.friendRequests = user.friendRequests?.filter((r) => r.fromId !== fromId) || [];

      if (accept) {
        if (!user.friends) user.friends = [];
        if (!friend.friends) friend.friends = [];

        if (!user.friends.includes(fromId)) user.friends.push(fromId);
        if (!friend.friends.includes(userId)) friend.friends.push(userId);
      }

      return { success: true, friend };
    });
  }

  async removeFriend(userId: string, friendId: string): Promise<boolean> {
    return this.write((data) => {
      const user = data.users.find((u) => u.id === userId);
      const friend = data.users.find((u) => u.id === friendId);
      if (!user || !friend) return false;

      user.friends = user.friends?.filter((id) => id !== friendId) || [];
      friend.friends = friend.friends?.filter((id) => id !== userId) || [];
      return true;
    });
  }

  async blockUser(userId: string, blockId: string, block: boolean): Promise<boolean> {
    return this.write((data) => {
      const user = data.users.find((u) => u.id === userId);
      const target = data.users.find((u) => u.id === blockId);
      if (!user) return false;

      if (!user.blockedUsers) user.blockedUsers = [];

      if (block) {
        if (!user.blockedUsers.includes(blockId)) {
          user.blockedUsers.push(blockId);
        }
        // Remove from friends list
        user.friends = user.friends?.filter((id) => id !== blockId) || [];
        if (target) {
          target.friends = target.friends?.filter((id) => id !== userId) || [];
        }
      } else {
        user.blockedUsers = user.blockedUsers.filter((id) => id !== blockId);
      }
      return true;
    });
  }

  async updatePrivacy(userId: string, privacyPatch: Partial<NonNullable<StoredUser["privacy"]>>): Promise<boolean> {
    return this.write((data) => {
      const user = data.users.find((u) => u.id === userId);
      if (!user) return false;
      user.privacy = {
        showOnlineStatus: privacyPatch.showOnlineStatus ?? user.privacy?.showOnlineStatus ?? true,
        allowFriendRequests: privacyPatch.allowFriendRequests ?? user.privacy?.allowFriendRequests ?? true,
        allowSpectators: privacyPatch.allowSpectators ?? user.privacy?.allowSpectators ?? true,
        allowPrivateInvites: privacyPatch.allowPrivateInvites ?? user.privacy?.allowPrivateInvites ?? true,
      };
      return true;
    });
  }

  async addRecentPlayer(userId: string, recentId: string): Promise<boolean> {
    return this.write((data) => {
      const user = data.users.find((u) => u.id === userId);
      const target = data.users.find((u) => u.id === recentId);
      if (!user || !target) return false;

      if (!user.recentPlayers) user.recentPlayers = [];
      
      // Filter out existing
      user.recentPlayers = user.recentPlayers.filter((p) => p.userId !== recentId);
      user.recentPlayers.unshift({
        userId: target.id,
        username: target.username,
        avatar: target.avatar,
        playedAt: new Date().toISOString(),
      });

      // Keep last 15 players
      user.recentPlayers = user.recentPlayers.slice(0, 15);
      return true;
    });
  }

  private async read(): Promise<StoreData> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as StoreData;
    } catch {
      return { users: [], refreshTokens: [] };
    }
  }

  private async write<T>(mutate: (data: StoreData) => T): Promise<T> {
    const operation = this.pending.then(async () => {
      const data = await this.read();
      const result = mutate(data);
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
      return result;
    });

    this.pending = operation.then(() => undefined, () => undefined);
    return operation;
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
