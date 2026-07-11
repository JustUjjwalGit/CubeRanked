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

export interface RankProgress {
  rank: RankInfo;
  nextRank: RankInfo | null;
  progress: number;
  eloWithinRank: number;
  eloRequiredForNext: number;
}

const RANKS: RankInfo[] = [
  { tier: "Unranked", division: null, color: "#64748b", minElo: 0, maxElo: null, badge: "UR" },
  { tier: "Bronze", division: "I", color: "#92400e", minElo: 0, maxElo: 399, badge: "B1" },
  { tier: "Bronze", division: "II", color: "#a16207", minElo: 400, maxElo: 799, badge: "B2" },
  { tier: "Bronze", division: "III", color: "#b45309", minElo: 800, maxElo: 1199, badge: "B3" },
  { tier: "Silver", division: "I", color: "#94a3b8", minElo: 1200, maxElo: 1399, badge: "S1" },
  { tier: "Silver", division: "II", color: "#cbd5e1", minElo: 1400, maxElo: 1599, badge: "S2" },
  { tier: "Silver", division: "III", color: "#e2e8f0", minElo: 1600, maxElo: 1799, badge: "S3" },
  { tier: "Gold", division: "I", color: "#d97706", minElo: 1800, maxElo: 1999, badge: "G1" },
  { tier: "Gold", division: "II", color: "#f59e0b", minElo: 2000, maxElo: 2199, badge: "G2" },
  { tier: "Gold", division: "III", color: "#fbbf24", minElo: 2200, maxElo: 2399, badge: "G3" },
  { tier: "Platinum", division: "I", color: "#0d9488", minElo: 2400, maxElo: 2599, badge: "P1" },
  { tier: "Platinum", division: "II", color: "#14b8a6", minElo: 2600, maxElo: 2799, badge: "P2" },
  { tier: "Platinum", division: "III", color: "#2dd4bf", minElo: 2800, maxElo: 2999, badge: "P3" },
  { tier: "Diamond", division: "I", color: "#2563eb", minElo: 3000, maxElo: 3199, badge: "D1" },
  { tier: "Diamond", division: "II", color: "#3b82f6", minElo: 3200, maxElo: 3399, badge: "D2" },
  { tier: "Diamond", division: "III", color: "#60a5fa", minElo: 3400, maxElo: 3599, badge: "D3" },
  { tier: "Master", division: null, color: "#7c3aed", minElo: 3600, maxElo: 3999, badge: "MS" },
  { tier: "Grandmaster", division: null, color: "#e11d48", minElo: 4000, maxElo: 4499, badge: "GM" },
  { tier: "Cube Legend", division: null, color: "#f97316", minElo: 4500, maxElo: null, badge: "CL" },
];

export const RANK_TIERS = RANKS;

export function getRankFromElo(elo: number, isPlacement: boolean = false): RankInfo {
  if (isPlacement) return RANKS[0];
  for (let i = RANKS.length - 1; i >= 1; i--) {
    const rank = RANKS[i];
    if (rank.maxElo === null || elo <= rank.maxElo) {
      if (elo >= rank.minElo) return rank;
    }
  }
  return RANKS[1];
}

export function getRankProgress(elo: number, isPlacement: boolean = false): RankProgress {
  if (isPlacement) {
    return {
      rank: RANKS[0],
      nextRank: null,
      progress: 0,
      eloWithinRank: 0,
      eloRequiredForNext: 0,
    };
  }

  const rank = getRankFromElo(elo, false);
  const rankIndex = RANKS.indexOf(rank);
  const nextRank = rankIndex < RANKS.length - 1 ? RANKS[rankIndex + 1] : null;

  if (!nextRank) {
    return {
      rank,
      nextRank: null,
      progress: 1,
      eloWithinRank: elo - rank.minElo,
      eloRequiredForNext: 0,
    };
  }

  const range = nextRank.minElo - rank.minElo;
  const eloWithinRank = elo - rank.minElo;
  const progress = Math.min(eloWithinRank / range, 1);

  return {
    rank,
    nextRank,
    progress,
    eloWithinRank,
    eloRequiredForNext: range,
  };
}

export function getNextRank(rank: RankInfo): RankInfo | null {
  const index = RANKS.indexOf(rank);
  if (index < 0 || index >= RANKS.length - 1) return null;
  return RANKS[index + 1];
}

export function getRankColor(elo: number, isPlacement: boolean = false): string {
  return getRankFromElo(elo, isPlacement).color;
}

export function getRankIconPath(rank: RankInfo): string {
  const slug = rank.tier.toLowerCase().replace(/\s+/g, "_");
  const div = rank.division ? `_${rank.division.toLowerCase()}` : "";
  return `/assets/ranks/${slug}${div}.svg`;
}

export function isRankPromotion(oldElo: number, newElo: number): { promoted: boolean; demoted: boolean; oldRank: RankInfo; newRank: RankInfo; changed: boolean } {
  const oldRank = getRankFromElo(oldElo, false);
  const newRank = getRankFromElo(newElo, false);
  const oldIndex = RANKS.indexOf(oldRank);
  const newIndex = RANKS.indexOf(newRank);
  return {
    promoted: newIndex > oldIndex,
    demoted: newIndex < oldIndex,
    oldRank,
    newRank,
    changed: oldIndex !== newIndex,
  };
}

// For backward compatibility
export function getRankFromRating(rating: number, isPlacement: boolean = false): RankInfo {
  return getRankFromElo(rating, isPlacement);
}
