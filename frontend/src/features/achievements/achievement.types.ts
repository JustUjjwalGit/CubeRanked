export type AchievementCategory =
  | "BEGINNER"
  | "PRACTICE"
  | "SPEED"
  | "COMPETITIVE"
  | "MASTERY"
  | "SOCIAL"
  | "SPECIAL";

export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  name: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  points: number;
  hidden?: boolean;
  parentId: string | null;
  criteria: { type: string; target: number };
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

export interface AchievementsData {
  achievements: AchievementDef[];
  progress: UserAchievementEntry[];
  totalPoints: number;
  earnedPoints: number;
}

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  BEGINNER: "Beginner",
  PRACTICE: "Practice",
  SPEED: "Speed",
  COMPETITIVE: "Competitive",
  MASTERY: "Mastery",
  SOCIAL: "Social",
  SPECIAL: "Special",
};

export const CATEGORY_ORDER: Record<AchievementCategory, number> = {
  BEGINNER: 0,
  PRACTICE: 1,
  SPEED: 2,
  COMPETITIVE: 3,
  MASTERY: 4,
  SOCIAL: 5,
  SPECIAL: 6,
};

export const CATEGORY_ICONS: Record<AchievementCategory, string> = {
  BEGINNER: "🌱",
  PRACTICE: "📖",
  SPEED: "⚡",
  COMPETITIVE: "🏆",
  MASTERY: "💎",
  SOCIAL: "👥",
  SPECIAL: "⭐",
};
