export type GameMode = "practice" | "bot-race" | "ranked" | "private";
export type PenaltyType = "none" | "+2" | "DNF";
export type ReplayResult = "SOLVED" | "DNF" | "QUIT";

export interface ReplayMove {
  move: string;
  timeOffsetMs: number;
}

export interface ReplayRecord {
  replayId: string;
  matchId: string;
  gameMode: GameMode;
  scramble: string[];
  startedAt: string;
  durationMs: number;
  inspectionTimeMs: number;
  penalty: PenaltyType;
  result: ReplayResult;
  won?: boolean;
  puzzle?: string;
  moves: ReplayMove[];
}
