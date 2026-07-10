import type { ReplayRecord } from "./replay";

export interface LifetimeStats {
  pbMs: number | null;
  ao5Ms: number | null;
  ao12Ms: number | null;
  ao100Ms: number | null;
  winRate: number; // 0 to 1
  avgTps: number;
  fastestTps: number;
  favoriteCubeType: string;
  mostPlayedMode: string;
  totalPlays: number;
}

export function calculateLifetimeStats(replays: ReplayRecord[]): LifetimeStats {
  const solvedReplays = replays.filter((r) => r.result === "SOLVED" && r.durationMs > 0);
  
  // 1. Personal Best (PB)
  let pbMs: number | null = null;
  if (solvedReplays.length > 0) {
    pbMs = Math.min(...solvedReplays.map((r) => r.durationMs));
  }

  // Helper for trimmed average
  const getTrimmedAverage = (count: number): number | null => {
    if (solvedReplays.length < count) return null;
    const subset = solvedReplays.slice(0, count).map((r) => r.durationMs);
    // Sort ascending
    subset.sort((a, b) => a - b);
    // Drop slowest and fastest
    const trimmed = subset.slice(1, -1);
    if (trimmed.length === 0) return null;
    return trimmed.reduce((sum, val) => sum + val, 0) / trimmed.length;
  };

  // 2. Averages (Ao5, Ao12, Ao100)
  const ao5Ms = getTrimmedAverage(5);
  const ao12Ms = getTrimmedAverage(12);
  const ao100Ms = getTrimmedAverage(100);

  // 3. Win Rate (ranked, private, bot-race)
  const competitiveGames = replays.filter((r) => r.gameMode !== "practice");
  const winRate = competitiveGames.length > 0
    ? competitiveGames.filter((r) => r.won === true).length / competitiveGames.length
    : 0;

  // 4. TPS (turns per second)
  let avgTps = 0;
  let fastestTps = 0;
  
  if (solvedReplays.length > 0) {
    let totalMoves = 0;
    let totalSeconds = 0;
    const tpsValues: number[] = [];

    for (const r of solvedReplays) {
      const moveCount = r.moves.length;
      const seconds = r.durationMs / 1000;
      if (seconds > 0) {
        const tps = moveCount / seconds;
        tpsValues.push(tps);
        totalMoves += moveCount;
        totalSeconds += seconds;
      }
    }

    if (totalSeconds > 0) {
      avgTps = totalMoves / totalSeconds;
    }
    if (tpsValues.length > 0) {
      fastestTps = Math.max(...tpsValues);
    }
  }

  // 5. Favorite Cube Type
  const cubeCounts: Record<string, number> = {};
  for (const r of replays) {
    const type = r.puzzle || "3x3";
    cubeCounts[type] = (cubeCounts[type] || 0) + 1;
  }
  let favoriteCubeType = "3x3";
  let maxCubeCount = 0;
  for (const [type, count] of Object.entries(cubeCounts)) {
    if (count > maxCubeCount) {
      maxCubeCount = count;
      favoriteCubeType = type;
    }
  }

  // 6. Most Played Mode
  const modeCounts: Record<string, number> = {};
  for (const r of replays) {
    modeCounts[r.gameMode] = (modeCounts[r.gameMode] || 0) + 1;
  }
  let mostPlayedMode = "practice";
  let maxModeCount = 0;
  for (const [mode, count] of Object.entries(modeCounts)) {
    if (count > maxModeCount) {
      maxModeCount = count;
      mostPlayedMode = mode;
    }
  }

  // Human friendly label
  const modeLabels: Record<string, string> = {
    practice: "Practice",
    "bot-race": "Bot Race",
    ranked: "Ranked Match",
    private: "Private Room",
  };

  return {
    pbMs,
    ao5Ms,
    ao12Ms,
    ao100Ms,
    winRate,
    avgTps: Math.round(avgTps * 100) / 100,
    fastestTps: Math.round(fastestTps * 100) / 100,
    favoriteCubeType,
    mostPlayedMode: modeLabels[mostPlayedMode] || mostPlayedMode,
    totalPlays: replays.length,
  };
}
