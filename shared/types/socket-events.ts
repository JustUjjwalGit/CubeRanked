import type {
  MatchFoundPayload,
  MatchStatePayload,
  MatchCountdownPayload,
  MatchStartPayload,
  MatchOpponentMovePayload,
  MatchResultsPayload,
  MatchDisconnectPayload,
  MatchReconnectPayload,
  MatchPlayAgainStatePayload,
  MatchPlayAgainCancelledPayload,
  QueueUpdatePayload,
} from "./match";
import type { RoomState } from "./room";
import type { FriendEntry, FriendRequestEntry, RecentPlayerEntry } from "./user";

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
  queueStatus: "idle" | "searching";
  synchronizationDelayMs: number | null;
  roomState: RoomState | null;
  roomError: string | null;
  friends: FriendEntry[];
  friendRequests: FriendRequestEntry[];
  recentOpponents: RecentPlayerEntry[];
  incomingInvite: unknown | null;
}

export interface ServerToClientEvents {
  "server:ready": (payload: ServerReadyPayload) => void;
  "presence:update": (payload: PresenceSnapshot) => void;
  "cube:move": (payload: RemoteCubeMovePayload) => void;
  "queue:update": (payload: QueueUpdatePayload) => void;
  "match:found": (payload: MatchFoundPayload) => void;
  "match:resume": (payload: MatchFoundPayload) => void;
  "match:state": (payload: MatchStatePayload) => void;
  "match:countdown": (payload: MatchCountdownPayload) => void;
  "match:start": (payload: MatchStartPayload) => void;
  "match:opponent-move": (payload: MatchOpponentMovePayload) => void;
  "match:results": (payload: MatchResultsPayload) => void;
  "match:opponent-disconnected": (payload: MatchDisconnectPayload) => void;
  "match:opponent-reconnected": (payload: MatchReconnectPayload) => void;
  "match:play-again-state": (payload: MatchPlayAgainStatePayload) => void;
  "match:play-again-cancelled": (payload: MatchPlayAgainCancelledPayload) => void;
  "room:state": (payload: RoomState) => void;
  "room:error": (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  "client:ping": (
    payload: { sentAt: number },
    acknowledge: (response: { sentAt: number; serverAt: number }) => void,
  ) => void;
  "cube:move": (payload: ClientCubeMovePayload) => void;
  "queue:join": () => void;
  "queue:cancel": () => void;
  "match:ready": (payload: { matchId: string }) => void;
  "match:move": (payload: { matchId: string; move: string; sequence: number; sentAt: number }) => void;
  "match:finish": (payload: { matchId: string; moveCount: number }) => void;
  "match:play-again": (payload: { matchId: string }) => void;
  "match:return-home": (payload: { matchId: string }) => void;
  "room:create": () => void;
  "room:join": (payload: { code: string }) => void;
  "room:spectate": (payload: { code: string }) => void;
  "room:ready": () => void;
  "room:settings": (payload: Partial<import("./room").RoomSettings>) => void;
  "room:chat": (payload: { text: string }) => void;
  "room:leave": () => void;
  "room:start": () => void;
  "room:reset-series": () => void;
  "session:authenticate": (payload: { username: string; avatar: string | null }) => void;
}
