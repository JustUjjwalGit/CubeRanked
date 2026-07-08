export type SocketConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";

export interface PresenceSnapshot {
  onlineCount: number;
  connectedPlayers: number;
  roomId: string;
  timestamp: number;
}

export interface ServerReadyPayload {
  version: string;
  socketId: string;
  clientId: string;
  username: string;
  roomId: string;
  timestamp: number;
}

export interface ClientCubeMovePayload {
  move: string;
  scramble: string[];
  sequence: number;
  sentAt: number;
}

export interface RemoteCubeMovePayload extends ClientCubeMovePayload {
  socketId: string;
  roomId: string;
  serverAt: number;
}

export type QueueStatus = "idle" | "searching";
export type MatchStatus = "loading" | "countdown" | "playing" | "finished";
export type MatchPlayerStatus = "loading" | "ready" | "playing" | "finished" | "disconnected" | "forfeit";

export interface QueueUpdatePayload {
  status: QueueStatus;
  queuePosition: number | null;
  elapsedMs: number;
  estimatedWaitMs: number | null;
}

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

export interface RoomPlayer {
  clientId: string;
  socketId: string;
  username: string;
  avatar: string | null;
  ready: boolean;
  connected: boolean;
  pingMs: number | null;
}

export interface RoomSettings {
  puzzle: "3x3";
  gameType: "race";
  inspectionEnabled: boolean;
  bestOf: 1 | 3 | 5;
  scrambleVisibility: "hidden" | "visible";
  botFill: boolean;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface RoomState {
  code: string;
  roomId: string;
  host: RoomPlayer;
  guest: RoomPlayer | null;
  spectator: RoomPlayer | null;
  settings: RoomSettings;
  status: "lobby" | "match" | "finished";
  currentMatchId: string | null;
  scores: Record<string, number>;
  chat: ChatMessage[];
  winnerClientId: string | null;
}

export interface SocketDebugSnapshot {
  socketId: string | null;
  clientId: string | null;
  username: string | null;
  roomId: string | null;
  connectionState: SocketConnectionState;
  pingMs: number | null;
  connectedPlayers: number;
  onlineCount: number;
  eventsSent: number;
  eventsReceived: number;
  currentMatchId: string | null;
  opponentSocketId: string | null;
  queueStatus: QueueStatus;
  synchronizationDelayMs: number | null;
  roomState: RoomState | null;
  roomError: string | null;
  friends: any[];
  friendRequests: any[];
  recentOpponents: any[];
  incomingInvite: any | null;
}
