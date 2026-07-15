import { DEFAULT_SETTINGS, type SessionSettings, type SolveRecord } from "./sessionStats";

const HISTORY_KEY = "cuberanked.practice.history";
const SETTINGS_KEY = "cuberanked.practice.settings";
const BEST_KEY = "cuberanked.practice.bestTimeMs";
const BOT_STATS_KEY = "cuberanked.botRace.stats";

interface BotRaceStats {
  wins: number;
  losses: number;
}

export function loadSettings(): SessionSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
    if (!saved || typeof saved !== "object") {
      return DEFAULT_SETTINGS;
    }
    // Merge saved settings with defaults to ensure all required keys exist
    return { ...DEFAULT_SETTINGS, ...saved } as SessionSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function loadHistory(): SolveRecord[] {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as SolveRecord[];
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function loadBotRaceStats(): BotRaceStats {
  try {
    const saved = JSON.parse(localStorage.getItem(BOT_STATS_KEY) ?? "null") as Partial<BotRaceStats> | null;
    return {
      wins: Number(saved?.wins ?? 0),
      losses: Number(saved?.losses ?? 0),
    };
  } catch {
    return { wins: 0, losses: 0 };
  }
}
