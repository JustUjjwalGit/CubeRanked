import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AppEnv } from "../types/env.js";
import type { UserAchievementEntry } from "./achievement.types.js";

interface AchievementStoreData {
  entries: UserAchievementEntry[];
}

export class AchievementStore {
  private readonly filePath: string;
  private pending = Promise.resolve();

  constructor(env: AppEnv) {
    this.filePath = resolve(process.cwd(), "data", "achievements.json");
  }

  async getEntries(userId: string): Promise<UserAchievementEntry[]> {
    const data = await this.read();
    return data
      .filter((e) => e.achievementId.startsWith(userId + ":"))
      .map((e) => ({ ...e, achievementId: e.achievementId.slice(userId.length + 1) }));
  }

  async upsertEntry(userId: string, entry: UserAchievementEntry): Promise<void> {
    await this.write((data) => {
      const key = `${userId}:${entry.achievementId}`;
      const existing = data.find((e) => e.achievementId === key);
      if (existing) {
        existing.progress = Math.max(existing.progress, entry.progress);
        existing.progressValue = entry.progressValue;
        existing.progressTarget = entry.progressTarget;
        if (entry.unlockedAt && !existing.unlockedAt) {
          existing.unlockedAt = entry.unlockedAt;
        }
      } else {
        data.push({ ...entry, achievementId: key });
      }
    });
  }

  async upsertEntries(userId: string, entries: UserAchievementEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.upsertEntry(userId, entry);
    }
  }

  async ensureEntries(userId: string, achievementIds: string[]): Promise<UserAchievementEntry[]> {
    const existing = await this.getEntries(userId);
    const existingMap = new Map(existing.map((e) => [e.achievementId, e]));
    const result: UserAchievementEntry[] = [];

    for (const id of achievementIds) {
      const found = existingMap.get(id);
      if (found) {
        result.push(found);
      } else {
        const fresh: UserAchievementEntry = {
          achievementId: id,
          unlockedAt: null,
          progress: 0,
          progressValue: 0,
          progressTarget: 1,
        };
        await this.upsertEntry(userId, fresh);
        result.push(fresh);
      }
    }

    return result;
  }

  private async read(): Promise<UserAchievementEntry[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as AchievementStoreData;
      return parsed.entries ?? [];
    } catch {
      return [];
    }
  }

  private async write<T>(mutate: (data: UserAchievementEntry[]) => T): Promise<T> {
    const operation = this.pending.then(async () => {
      const data = await this.read();
      const result = mutate(data);
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(
        this.filePath,
        `${JSON.stringify({ entries: data }, null, 2)}\n`,
        "utf8"
      );
      return result;
    });

    this.pending = operation.then(() => undefined, () => undefined);
    return operation;
  }
}
