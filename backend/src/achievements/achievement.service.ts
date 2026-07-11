import { AchievementStore } from "./achievement-store.js";
import type {
  AchievementCheckResult,
  AchievementCriteria,
  AchievementEvent,
  UserAchievementEntry,
} from "./achievement.types.js";
import { ACHIEVEMENTS } from "./achievement.data.js";
import type { UserStore, StoredUser } from "../users/user-store.js";

export class AchievementService {
  constructor(
    private readonly store: AchievementStore,
    private readonly userStore: UserStore,
  ) {}

  async getAllWithProgress(userId: string): Promise<{
    achievements: typeof ACHIEVEMENTS;
    progress: UserAchievementEntry[];
    totalPoints: number;
    earnedPoints: number;
  }> {
    const entries = await this.store.ensureEntries(
      userId,
      ACHIEVEMENTS.map((a) => a.id)
    );
    const earnedPoints = entries
      .filter((e) => e.unlockedAt != null)
      .reduce((sum, e) => {
        const def = ACHIEVEMENTS.find((a) => a.id === e.achievementId);
        return sum + (def?.points ?? 0);
      }, 0);

    return {
      achievements: ACHIEVEMENTS,
      progress: entries,
      totalPoints: ACHIEVEMENTS.reduce((s, a) => s + a.points, 0),
      earnedPoints,
    };
  }

  async processEvent(
    userId: string,
    event: AchievementEvent
  ): Promise<AchievementCheckResult> {
    await this.applyEventToStats(userId, event);

    const user = await this.userStore.findUserById(userId);
    if (!user) {
      return { newlyUnlocked: [], updated: [] };
    }

    const stats = computeStats(user);
    const entries = await this.store.getEntries(userId);
    const progressMap = new Map(entries.map((e) => [e.achievementId, e]));
    const newlyUnlocked: AchievementCheckResult["newlyUnlocked"] = [];

    const relevant = ACHIEVEMENTS.filter((a) => {
      const t = a.criteria.type;
      switch (event.type) {
        case "solve_complete":
          return ["solves_count", "best_time", "avg_of_5", "avg_of_12", "avg_tps", "total_solves", "total_moves", "night_owl"].includes(t);
        case "bot_complete":
          return ["solves_count"].includes(t);
        case "match_complete":
          return ["ranked_matches", "ranked_wins", "win_margin", "reverse_sweep"].includes(t);
        case "win_streak":
          return ["win_streak"].includes(t);
        case "friend_added":
          return ["friends_count"].includes(t);
        case "private_match_complete":
          return ["private_matches"].includes(t);
        case "spectate_match":
          return ["spectate_matches"].includes(t);
        case "tutorial_complete":
          return ["tutorial_complete"].includes(t);
        case "elo_changed":
          return ["elo_reached"].includes(t);
        case "google_login":
          return ["google_login"].includes(t);
        case "birthday_solve":
          return ["birthday_solve"].includes(t);
        default:
          return false;
      }
    });

    for (const achievement of relevant) {
      const existing = progressMap.get(achievement.id);
      const currentProgress = existing?.progress ?? 0;

      if (currentProgress >= 1) continue;

      if (achievement.parentId) {
        const parent = progressMap.get(achievement.parentId);
        if (!parent || parent.progress < 1) continue;
      }

      const { progress, progressValue } = this.evaluateCriteria(
        achievement.criteria,
        stats,
        event
      );

      if (progress <= currentProgress) continue;

      const unlockedAt = progress >= 1 ? new Date().toISOString() : null;
      const target = achievement.criteria.target;

      const entry: UserAchievementEntry = {
        achievementId: achievement.id,
        unlockedAt,
        progress: Math.min(progress, 1),
        progressValue,
        progressTarget: target,
      };

      await this.store.upsertEntry(userId, entry);

      if (unlockedAt) {
        newlyUnlocked.push({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          rarity: achievement.rarity,
          category: achievement.category,
        });
      }
    }

    const updated = await this.store.getEntries(userId);
    return { newlyUnlocked, updated };
  }

  private async applyEventToStats(userId: string, event: AchievementEvent): Promise<void> {
    if (event.type === "solve_complete") {
      const solveTimeMs = event.data.solveTimeMs as number | undefined;
      const moveCount = event.data.moveCount as number | undefined;
      if (solveTimeMs != null) {
        const user = await this.userStore.findUserById(userId);
        if (user) {
          const stats = user.statistics;
          const newBest = stats.bestTimeMs == null || solveTimeMs < stats.bestTimeMs;
          const history = (stats.practiceHistory ?? []) as Array<{ finalTimeMs?: number; moveCount?: number }>;
          const updatedHistory = [
            { finalTimeMs: solveTimeMs, moveCount: moveCount ?? 0 },
            ...history,
          ].slice(0, 500);
          await this.userStore.updateStatistics(userId, {
            gamesPlayed: stats.gamesPlayed + 1,
            bestTimeMs: newBest ? solveTimeMs : stats.bestTimeMs,
            practiceHistory: updatedHistory,
          });
        }
      }
    }

    if (event.type === "match_complete") {
      const won = event.data.won as boolean | undefined;
      const user = await this.userStore.findUserById(userId);
      if (user) {
        const patch: Record<string, unknown> = {
          gamesPlayed: user.statistics.gamesPlayed + 1,
        };
        if (won) {
          patch.wins = user.statistics.wins + 1;
        } else {
          patch.losses = user.statistics.losses + 1;
        }
        await this.userStore.updateStatistics(userId, patch as any);
      }
    }

    if (event.type === "win_streak") {
      const streak = event.data.streak as number | undefined;
      if (streak != null) {
        await this.userStore.updateUser(userId, { streak } as any);
      }
    }

    if (event.type === "friend_added") {
      const user = await this.userStore.findUserById(userId);
      if (user) {
        const count = (event.data.count as number) ?? (user.friends?.length ?? 0) + 1;
        if (!user.friends?.includes(event.data.friendId as string)) {
          const friends = [...(user.friends ?? []), event.data.friendId as string];
          await this.userStore.updateUser(userId, { friends } as any);
        }
      }
    }

    if (event.type === "private_match_complete") {
      const user = await this.userStore.findUserById(userId);
      if (user) {
        await this.userStore.updateStatistics(userId, {
          gamesPlayed: user.statistics.gamesPlayed + 1,
        });
      }
    }

    if (event.type === "elo_changed") {
      const rating = event.data.rating as number | undefined;
      if (rating != null) {
        await this.userStore.updateUser(userId, { rating } as any);
      }
    }
  }

  private evaluateCriteria(
    criteria: AchievementCriteria,
    stats: ReturnType<typeof computeStats>,
    event: AchievementEvent
  ): { progress: number; progressValue: number } {
    switch (criteria.type) {
      case "solves_count": {
        const v = stats.solvesCount;
        return { progress: Math.min(v / criteria.target, 1), progressValue: v };
      }
      case "best_time": {
        const v = stats.bestTime ?? Infinity;
        return {
          progress: v <= criteria.target ? 1 : 0,
          progressValue: v === Infinity ? 0 : v,
        };
      }
      case "avg_of_5": {
        const v = stats.avgOf5 ?? Infinity;
        return {
          progress: v <= criteria.target ? 1 : 0,
          progressValue: v === Infinity ? 0 : v,
        };
      }
      case "avg_of_12": {
        const v = stats.avgOf12 ?? Infinity;
        return {
          progress: v <= criteria.target ? 1 : 0,
          progressValue: v === Infinity ? 0 : v,
        };
      }
      case "avg_tps": {
        const v = stats.avgTps ?? 0;
        return {
          progress: v >= criteria.target / 1000 ? 1 : 0,
          progressValue: Math.round(v * 100) / 100,
        };
      }
      case "ranked_matches": {
        const v = stats.rankedMatches;
        return { progress: Math.min(v / criteria.target, 1), progressValue: v };
      }
      case "ranked_wins": {
        const v = stats.rankedWins;
        return { progress: Math.min(v / criteria.target, 1), progressValue: v };
      }
      case "win_streak": {
        const v = stats.winStreak;
        return { progress: Math.min(v / criteria.target, 1), progressValue: v };
      }
      case "elo_reached": {
        const v = stats.currentElo;
        return {
          progress: v >= criteria.target ? 1 : 0,
          progressValue: v,
        };
      }
      case "friends_count": {
        const v = stats.friendsCount;
        return { progress: Math.min(v / criteria.target, 1), progressValue: v };
      }
      case "private_matches": {
        const v = stats.privateMatches;
        return { progress: Math.min(v / criteria.target, 1), progressValue: v };
      }
      case "spectate_matches": {
        const v = stats.spectateMatches;
        return { progress: Math.min(v / criteria.target, 1), progressValue: v };
      }
      case "birthday_solve": {
        const onBirthday = event.data.onBirthday as boolean | undefined;
        return {
          progress: onBirthday ? 1 : 0,
          progressValue: onBirthday ? 1 : 0,
        };
      }
      case "night_owl": {
        const isNightOwl = event.data.isNightOwl as boolean | undefined;
        return {
          progress: isNightOwl ? 1 : 0,
          progressValue: isNightOwl ? 1 : 0,
        };
      }
      case "google_login": {
        return { progress: 1, progressValue: 1 };
      }
      case "reverse_sweep": {
        const swept = event.data.reverseSweep as boolean | undefined;
        return {
          progress: swept ? 1 : 0,
          progressValue: swept ? 1 : 0,
        };
      }
      case "total_solves": {
        const v = stats.totalSolves;
        return { progress: Math.min(v / criteria.target, 1), progressValue: v };
      }
      default:
        return { progress: 0, progressValue: 0 };
    }
  }
}

interface ComputedStats {
  solvesCount: number;
  bestTime: number | null;
  avgOf5: number | null;
  avgOf12: number | null;
  avgTps: number | null;
  rankedMatches: number;
  rankedWins: number;
  winStreak: number;
  friendsCount: number;
  privateMatches: number;
  spectateMatches: number;
  currentElo: number;
  totalSolves: number;
}

function computeStats(user: StoredUser): ComputedStats {
  const s = user.statistics;
  const history = (s.practiceHistory ?? []) as Array<{ finalTimeMs?: number; moveCount?: number }>;
  const valid = history.filter((h) => h.finalTimeMs != null && h.finalTimeMs > 0);
  const times = valid.map((h) => h.finalTimeMs!);

  const avgOf5 = times.length >= 5
    ? times.slice(0, 5).reduce((a, b) => a + b, 0) / 5
    : null;
  const avgOf12 = times.length >= 12
    ? times.slice(0, 12).reduce((a, b) => a + b, 0) / 12
    : null;

  const moves = valid.map((h) => h.moveCount ?? 0);
  const totalTps = moves.length > 0
    ? moves.reduce((a, b) => a + b, 0) / times.reduce((a, b) => a + b, 0) * 1000
    : null;

  return {
    solvesCount: s.gamesPlayed,
    bestTime: s.bestTimeMs ?? null,
    avgOf5,
    avgOf12,
    avgTps: totalTps,
    rankedMatches: s.gamesPlayed,
    rankedWins: s.wins,
    winStreak: user.streak ?? 0,
    friendsCount: user.friends?.length ?? 0,
    privateMatches: 0,
    spectateMatches: 0,
    currentElo: user.rating ?? 1200,
    totalSolves: times.length,
  };
}
