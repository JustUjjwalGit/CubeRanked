export type RankTier =
  | "Unranked"
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Master"
  | "Legend";

export interface RankInfo {
  tier: RankTier;
  color: string;
  minRating: number;
  maxRating: number | null;
  badge: string;
}
