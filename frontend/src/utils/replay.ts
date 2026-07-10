export interface ReplayMove {
  move: string;
  timeOffsetMs: number; // millisecond offset relative to solve start
}

export interface ReplayRecord {
  replayId: string;
  matchId: string;
  gameMode: "practice" | "ranked" | "bot-race" | "private";
  scramble: string[];
  startedAt: string;
  durationMs: number;
  inspectionTimeMs: number;
  penalty: "none" | "+2" | "DNF";
  result: "SOLVED" | "DNF" | "QUIT";
  won?: boolean; // true if won, false if lost, undefined for offline practice
  puzzle?: string; // e.g. "3x3"
  moves: ReplayMove[];
}

export function saveReplay(replay: ReplayRecord): void {
  try {
    const key = "cuberanked.replays";
    const existingRaw = localStorage.getItem(key);
    const replays: ReplayRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
    
    // Add new replay to start of list
    replays.unshift(replay);
    
    // Limit local storage to the last 150 replays
    localStorage.setItem(key, JSON.stringify(replays.slice(0, 150)));
  } catch (err) {
    console.error("Failed to save replay locally:", err);
  }
}

export function getLocalReplays(): ReplayRecord[] {
  try {
    const key = "cuberanked.replays";
    const existingRaw = localStorage.getItem(key);
    return existingRaw ? JSON.parse(existingRaw) : [];
  } catch {
    return [];
  }
}
