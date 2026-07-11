export type AchievementCategory =
  | "BEGINNER"
  | "PRACTICE"
  | "SPEED"
  | "COMPETITIVE"
  | "MASTERY"
  | "SOCIAL"
  | "SPECIAL";

export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

export interface AchievementCriteria {
  type:
    | "solves_count"
    | "best_time"
    | "avg_time"
    | "avg_of_5"
    | "avg_of_12"
    | "avg_tps"
    | "ranked_matches"
    | "ranked_wins"
    | "win_streak"
    | "elo_reached"
    | "friends_count"
    | "private_matches"
    | "spectate_matches"
    | "tutorial_complete"
    | "win_margin"
    | "inspection_solve"
    | "reverse_sweep"
    | "total_moves"
    | "total_solves"
    | "birthday_solve"
    | "night_owl"
    | "google_login";
  target: number;
}

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  name: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  points: number;
  hidden?: boolean;
  parentId?: string | null;
  criteria: AchievementCriteria;
  order: number;
}

export interface UserAchievementEntry {
  achievementId: string;
  unlockedAt: string | null;
  progress: number;
  progressValue: number;
  progressTarget: number;
}

export interface AchievementEvent {
  type:
    | "solve_complete"
    | "match_complete"
    | "friend_added"
    | "elo_changed"
    | "tutorial_complete"
    | "bot_complete"
    | "private_match_complete"
    | "win_streak"
    | "spectate_match"
    | "birthday_solve"
    | "google_login";
  data: Record<string, unknown>;
}

export interface NewlyUnlockedInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  category: string;
}

export interface AchievementCheckResult {
  newlyUnlocked: NewlyUnlockedInfo[];
  updated: UserAchievementEntry[];
}
