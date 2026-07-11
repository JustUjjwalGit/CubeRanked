export type RankTier =
  | "Unranked"
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Master"
  | "Grandmaster"
  | "Cube Legend";

export type RankDivision = "I" | "II" | "III" | null;

export interface RankInfo {
  tier: RankTier;
  division: RankDivision;
  color: string;
  minElo: number;
  maxElo: number | null;
  badge: string;
}
