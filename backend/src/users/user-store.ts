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
      };

      data.users.push(user);
      return user;
    });
  }

  async updateUser(id: string, patch: Partial<Pick<StoredUser, "username" | "avatar" | "country" | "bio" | "theme" | "favoriteMode" | "status">>): Promise<StoredUser | null> {
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
