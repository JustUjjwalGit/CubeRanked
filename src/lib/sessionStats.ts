import type { Penalty } from "./scramble";

export interface SolveRecord {
  id: string;
  rawTimeMs: number;
  finalTimeMs: number | null;
  penalty: Penalty;
  scramble: string[];
  moveCount: number;
  tps: number;
  createdAt: string;
}

export interface SessionSettings {
  inspectionEnabled: boolean;
  animationSpeed: number;
  theme: "dark" | "light";
  hudVisible: boolean;
  showKeyboardCheatSheet: boolean;
  keybindings: Record<string, string>;
}

export interface SessionStats {
  previousSolve: SolveRecord | null;
  bestSolve: SolveRecord | null;
  worstSolve: SolveRecord | null;
  sessionAverageMs: number | null;
  averageOf5Ms: number | null;
  averageOf12Ms: number | null;
  solveCount: number;
}

export const DEFAULT_SETTINGS: SessionSettings = {
  inspectionEnabled: true,
  animationSpeed: 0.24,
  theme: "dark",
  hudVisible: true,
  showKeyboardCheatSheet: true,
  keybindings: {
    U: "U",
    R: "R",
    F: "F",
    D: "D",
    L: "L",
    B: "B",
  },
};

export function calculateStats(history: SolveRecord[]): SessionStats {
  const validSolves = history.filter((solve) => solve.finalTimeMs !== null);

  return {
    previousSolve: history[0] ?? null,
    bestSolve: minSolve(validSolves),
    worstSolve: maxSolve(validSolves),
    sessionAverageMs: average(validSolves.map((solve) => solve.finalTimeMs!)),
    averageOf5Ms: trimmedAverage(validSolves.slice(0, 5).map((solve) => solve.finalTimeMs!), 5),
    averageOf12Ms: trimmedAverage(validSolves.slice(0, 12).map((solve) => solve.finalTimeMs!), 12),
    solveCount: history.length,
  };
}

export function formatTime(timeMs: number | null | undefined): string {
  if (timeMs === null || timeMs === undefined || Number.isNaN(timeMs)) {
    return "-";
  }

  const sign = timeMs < 0 ? "-" : "";
  const absolute = Math.abs(timeMs);
  const minutes = Math.floor(absolute / 60_000);
  const seconds = Math.floor((absolute % 60_000) / 1_000);
  const milliseconds = Math.floor(absolute % 1_000);

  if (minutes > 0) {
    return `${sign}${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds
      .toString()
      .padStart(3, "0")}`;
  }

  return `${sign}${seconds}.${milliseconds.toString().padStart(3, "0")}`;
}

export function formatSolveTime(solve: SolveRecord | null | undefined): string {
  if (!solve) {
    return "-";
  }

  if (solve.penalty === "DNF") {
    return "DNF";
  }

  return `${formatTime(solve.finalTimeMs)}${solve.penalty === "+2" ? "+" : ""}`;
}

export function createSolveRecord(input: {
  rawTimeMs: number;
  penalty: Penalty;
  scramble: string[];
  moveCount: number;
}): SolveRecord {
  const finalTimeMs = input.penalty === "DNF"
    ? null
    : input.rawTimeMs + (input.penalty === "+2" ? 2_000 : 0);
  const seconds = Math.max(input.rawTimeMs / 1_000, 0.001);

  return {
    id: crypto.randomUUID(),
    rawTimeMs: input.rawTimeMs,
    finalTimeMs,
    penalty: input.penalty,
    scramble: input.scramble,
    moveCount: input.moveCount,
    tps: input.moveCount / seconds,
    createdAt: new Date().toISOString(),
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function trimmedAverage(values: number[], requiredLength: number): number | null {
  if (values.length < requiredLength) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const trimmed = sorted.slice(1, -1);
  return average(trimmed);
}

function minSolve(solves: SolveRecord[]): SolveRecord | null {
  return solves.reduce<SolveRecord | null>((best, solve) => {
    if (!best || solve.finalTimeMs! < best.finalTimeMs!) {
      return solve;
    }

    return best;
  }, null);
}

function maxSolve(solves: SolveRecord[]): SolveRecord | null {
  return solves.reduce<SolveRecord | null>((worst, solve) => {
    if (!worst || solve.finalTimeMs! > worst.finalTimeMs!) {
      return solve;
    }

    return worst;
  }, null);
}
