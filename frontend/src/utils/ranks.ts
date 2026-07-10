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

export const RANK_TIERS: RankInfo[] = [
  { tier: "Unranked", color: "#64748b", minRating: 0, maxRating: null, badge: "UR" }, // Special case
  { tier: "Bronze", color: "#b45309", minRating: 0, maxRating: 1199, badge: "BR" },
  { tier: "Silver", color: "#94a3b8", minRating: 1200, maxRating: 1399, badge: "SV" },
  { tier: "Gold", color: "#d97706", minRating: 1400, maxRating: 1599, badge: "GD" },
  { tier: "Platinum", color: "#0d9488", minRating: 1600, maxRating: 1799, badge: "PL" },
  { tier: "Diamond", color: "#2563eb", minRating: 1800, maxRating: 1999, badge: "DM" },
  { tier: "Master", color: "#7c3aed", minRating: 2000, maxRating: 2199, badge: "MS" },
  { tier: "Legend", color: "#e11d48", minRating: 2200, maxRating: null, badge: "LG" },
];

export function getRankFromRating(rating: number, isPlacement: boolean = false): RankInfo {
  if (isPlacement) return RANK_TIERS[0];
  
  // Start from Bronze (index 1) to find the correct tier
  for (let i = 1; i < RANK_TIERS.length; i++) {
    const tier = RANK_TIERS[i];
    if (tier.maxRating === null || rating <= tier.maxRating) {
      return tier;
    }
  }
  
  return RANK_TIERS[RANK_TIERS.length - 1];
}
