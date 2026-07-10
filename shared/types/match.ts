export type MatchStatus = "loading" | "countdown" | "playing" | "finished";
export type MatchPlayerStatus = "loading" | "ready" | "playing" | "finished" | "disconnected" | "forfeit";
export type QueueStatus = "idle" | "searching";

export interface MatchPlayerSnapshot {
  clientId: string;
  socketId: string;
  username: string;
  ready: boolean;
  connected: boolean;
  status: MatchPlayerStatus;
  moveCount: number;
  finalTimeMs: number | null;
  tps: number;
  pingMs: number | null;
  disconnectDeadlineAt: number | null;
  playAgain: boolean;
}

export interface MatchFoundPayload {
  matchId: string;
  roomId: string;
  scrambleId: string;
  scramble: string[];
  status: MatchStatus;
  serverNow: number;
  startAt: number | null;
  countdownAt: number | null;
  you: MatchPlayerSnapshot;
  opponent: MatchPlayerSnapshot | null;
}

export interface MatchStatePayload {
  matchId: string;
  status: MatchStatus;
  players: MatchPlayerSnapshot[];
  serverNow: number;
}

export interface MatchCountdownPayload {
  matchId: string;
  countdownAt: number;
  countdownMs: number;
  serverNow: number;
}

export interface MatchStartPayload {
  matchId: string;
  startAt: number;
  serverNow: number;
}

export interface MatchOpponentMovePayload {
  matchId: string;
  move: string;
  sequence: number;
  socketId: string;
  clientId: string;
  serverAt: number;
  synchronizationDelayMs: number;
}

export interface RatingUpdate {
  clientId: string;
  previousRating: number;
  newRating: number;
  isPlacement: boolean;
  placementMatchesPlayed: number;
  tierDemoted?: boolean;
  tierPromoted?: boolean;
}

export interface MatchResultsPayload {
  matchId: string;
  scrambleId: string;
  scramble: string[];
  winnerClientId: string | null;
  loserClientId: string | null;
  timeDifferenceMs: number | null;
  players: MatchPlayerSnapshot[];
  serverNow: number;
  ratingUpdates?: RatingUpdate[];
}

export interface MatchDisconnectPayload {
  matchId: string;
  player: MatchPlayerSnapshot;
  deadlineAt: number;
  serverNow: number;
}

export interface MatchReconnectPayload {
  matchId: string;
  player: MatchPlayerSnapshot;
  serverNow: number;
}

export interface MatchPlayAgainStatePayload {
  matchId: string;
  players: MatchPlayerSnapshot[];
  serverNow: number;
}

export interface MatchPlayAgainCancelledPayload {
  matchId: string;
  player: MatchPlayerSnapshot;
  serverNow: number;
}

export interface QueueUpdatePayload {
  status: QueueStatus;
  queuePosition: number | null;
  elapsedMs: number;
  estimatedWaitMs: number | null;
}
