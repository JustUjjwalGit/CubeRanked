import { io, type Socket } from "socket.io-client";
import type {
  ClientCubeMovePayload,
  MatchCountdownPayload,
  MatchDisconnectPayload,
  MatchFoundPayload,
  MatchOpponentMovePayload,
  MatchPlayAgainCancelledPayload,
  MatchPlayAgainStatePayload,
  MatchReconnectPayload,
  MatchResultsPayload,
  MatchStartPayload,
  MatchStatePayload,
  PresenceSnapshot,
  QueueUpdatePayload,
  RemoteCubeMovePayload,
  ServerReadyPayload,
  SocketDebugSnapshot,
  RoomSettings,
  RoomState,
} from "./socketTypes";

type SnapshotListener = (snapshot: SocketDebugSnapshot) => void;
type RemoteMoveListener = (payload: RemoteCubeMovePayload) => void;

interface MatchListeners {
  queueUpdate: Set<(payload: QueueUpdatePayload) => void>;
  found: Set<(payload: MatchFoundPayload) => void>;
  resume: Set<(payload: MatchFoundPayload) => void>;
  state: Set<(payload: MatchStatePayload) => void>;
  countdown: Set<(payload: MatchCountdownPayload) => void>;
  start: Set<(payload: MatchStartPayload) => void>;
  opponentMove: Set<(payload: MatchOpponentMovePayload) => void>;
  results: Set<(payload: MatchResultsPayload) => void>;
  opponentDisconnected: Set<(payload: MatchDisconnectPayload) => void>;
  opponentReconnected: Set<(payload: MatchReconnectPayload) => void>;
  playAgainState: Set<(payload: MatchPlayAgainStatePayload) => void>;
  playAgainCancelled: Set<(payload: MatchPlayAgainCancelledPayload) => void>;
}

interface MatchEventPayloads {
  queueUpdate: QueueUpdatePayload;
  found: MatchFoundPayload;
  resume: MatchFoundPayload;
  state: MatchStatePayload;
  countdown: MatchCountdownPayload;
  start: MatchStartPayload;
  opponentMove: MatchOpponentMovePayload;
  results: MatchResultsPayload;
  opponentDisconnected: MatchDisconnectPayload;
  opponentReconnected: MatchReconnectPayload;
  playAgainState: MatchPlayAgainStatePayload;
  playAgainCancelled: MatchPlayAgainCancelledPayload;
}

interface ServerToClientEvents {
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

interface ClientToServerEvents {
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
  "room:settings": (payload: Partial<RoomSettings>) => void;
  "room:chat": (payload: { text: string }) => void;
  "room:leave": () => void;
  "room:start": () => void;
  "room:reset-series": () => void;
  "session:authenticate": (payload: { username: string; avatar: string | null }) => void;
}

const socketBaseUrl = import.meta.env.VITE_SOCKET_URL ?? "http://127.0.0.1:4000/v1";
const CLIENT_ID_KEY = "cuberanked.clientId";

class CubeRankedSocketManager {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private snapshotListeners = new Set<SnapshotListener>();
  private remoteMoveListeners = new Set<RemoteMoveListener>();
  private matchListeners: MatchListeners = {
    queueUpdate: new Set(),
    found: new Set(),
    resume: new Set(),
    state: new Set(),
    countdown: new Set(),
    start: new Set(),
    opponentMove: new Set(),
    results: new Set(),
    opponentDisconnected: new Set(),
    opponentReconnected: new Set(),
    playAgainState: new Set(),
    playAgainCancelled: new Set(),
  };
  private pingTimer = 0;
  private moveSequence = 0;
  private matchMoveSequence = 0;
  private clientId = getOrCreateClientId();
  private hasConnectedOnce = false;
  private snapshot: SocketDebugSnapshot = {
    socketId: null,
    clientId: this.clientId,
    username: null,
    roomId: null,
    connectionState: "connecting",
    pingMs: null,
    connectedPlayers: 0,
    onlineCount: 0,
    eventsSent: 0,
    eventsReceived: 0,
    currentMatchId: null,
    opponentSocketId: null,
    queueStatus: "idle",
    synchronizationDelayMs: null,
    roomState: null,
    roomError: null,
  };

  connect() {
    if (this.socket) {
      return;
    }

    this.setSnapshot({ connectionState: "connecting" });

    this.socket = io(socketBaseUrl, {
      auth: {
        clientId: this.clientId,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4_000,
    }) as unknown as Socket<ServerToClientEvents, ClientToServerEvents>;

    this.socket.on("connect", () => {
      this.hasConnectedOnce = true;
      this.setSnapshot({
        socketId: this.socket?.id ?? null,
        connectionState: "connected",
      });
      this.startPingLoop();
    });

    this.socket.io.on("reconnect_attempt", () => {
      if (this.hasConnectedOnce) {
        this.setSnapshot({ connectionState: "reconnecting" });
      } else {
        this.setSnapshot({ connectionState: "connecting" });
      }
    });

    this.socket.io.on("reconnect", () => {
      this.setSnapshot({
        socketId: this.socket?.id ?? null,
        connectionState: "connected",
      });
      this.ping();
    });

    this.socket.on("disconnect", (reason) => {
      window.clearInterval(this.pingTimer);
      if (reason === "io client disconnect" || reason === "io server disconnect") {
        this.setSnapshot({ connectionState: "disconnected", pingMs: null });
      } else {
        this.setSnapshot({ connectionState: "reconnecting", pingMs: null });
      }
    });

    this.socket.on("connect_error", () => {
      this.setSnapshot({
        connectionState: this.hasConnectedOnce ? "reconnecting" : "disconnected",
        pingMs: null,
      });
    });

    this.socket.on("server:ready", (payload) => {
      this.incrementReceived();
      this.clientId = payload.clientId;
      localStorage.setItem(CLIENT_ID_KEY, payload.clientId);
      this.setSnapshot({
        socketId: payload.socketId,
        clientId: payload.clientId,
        username: payload.username,
        roomId: payload.roomId,
      });
    });

    this.socket.on("presence:update", (payload) => {
      this.incrementReceived();
      this.setSnapshot({
        roomId: payload.roomId,
        connectedPlayers: payload.connectedPlayers,
        onlineCount: payload.onlineCount,
      });
    });

    this.socket.on("cube:move", (payload) => {
      this.incrementReceived();
      for (const listener of this.remoteMoveListeners) {
        listener(payload);
      }
    });

    this.socket.on("queue:update", (payload) => {
      this.incrementReceived();
      this.setSnapshot({ queueStatus: payload.status });
      this.emitMatchEvent("queueUpdate", payload);
    });

    this.socket.on("match:found", (payload) => {
      this.handleMatchPayload(payload);
      this.emitMatchEvent("found", payload);
    });

    this.socket.on("match:resume", (payload) => {
      this.handleMatchPayload(payload);
      this.emitMatchEvent("resume", payload);
    });

    this.socket.on("match:state", (payload) => {
      this.incrementReceived();
      const opponent = payload.players.find((player) => player.clientId !== this.snapshot.clientId);
      this.setSnapshot({
        currentMatchId: payload.matchId,
        opponentSocketId: opponent?.socketId ?? this.snapshot.opponentSocketId,
      });
      this.emitMatchEvent("state", payload);
    });

    this.socket.on("room:state", (payload) => {
      this.incrementReceived();
      this.setSnapshot({
        roomState: payload,
        roomError: null,
      });
    });

    this.socket.on("room:error", (payload) => {
      this.incrementReceived();
      this.setSnapshot({
        roomError: payload.message,
      });
    });

    this.socket.on("match:countdown", (payload) => {
      this.incrementReceived();
      this.emitMatchEvent("countdown", payload);
    });

    this.socket.on("match:start", (payload) => {
      this.incrementReceived();
      this.emitMatchEvent("start", payload);
    });

    this.socket.on("match:opponent-move", (payload) => {
      this.incrementReceived();
      this.setSnapshot({ synchronizationDelayMs: payload.synchronizationDelayMs });
      this.emitMatchEvent("opponentMove", payload);
    });

    this.socket.on("match:results", (payload) => {
      this.incrementReceived();
      this.emitMatchEvent("results", payload);
    });

    this.socket.on("match:opponent-disconnected", (payload) => {
      this.incrementReceived();
      this.emitMatchEvent("opponentDisconnected", payload);
    });

    this.socket.on("match:opponent-reconnected", (payload) => {
      this.incrementReceived();
      this.emitMatchEvent("opponentReconnected", payload);
    });

    this.socket.on("match:play-again-state", (payload) => {
      this.incrementReceived();
      this.emitMatchEvent("playAgainState", payload);
    });

    this.socket.on("match:play-again-cancelled", (payload) => {
      this.incrementReceived();
      this.emitMatchEvent("playAgainCancelled", payload);
    });
  }

  disconnect() {
    window.clearInterval(this.pingTimer);
    this.socket?.disconnect();
    this.socket = null;
    this.setSnapshot({
      socketId: null,
      roomId: null,
      connectionState: "disconnected",
      pingMs: null,
      connectedPlayers: 0,
      onlineCount: 0,
      queueStatus: "idle",
    });
  }

  joinQueue() {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit("queue:join");
    this.incrementSent();
    this.setSnapshot({ queueStatus: "searching" });
  }

  cancelQueue() {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit("queue:cancel");
    this.incrementSent();
    this.setSnapshot({ queueStatus: "idle" });
  }

  createRoom() {
    if (!this.socket?.connected) return;
    this.socket.emit("room:create");
    this.incrementSent();
  }

  joinRoom(code: string) {
    if (!this.socket?.connected) return;
    this.socket.emit("room:join", { code });
    this.incrementSent();
  }

  spectateRoom(code: string) {
    if (!this.socket?.connected) return;
    this.socket.emit("room:spectate", { code });
    this.incrementSent();
  }

  toggleRoomReady() {
    if (!this.socket?.connected) return;
    this.socket.emit("room:ready");
    this.incrementSent();
  }

  updateRoomSettings(settings: Partial<RoomSettings>) {
    if (!this.socket?.connected) return;
    this.socket.emit("room:settings", settings);
    this.incrementSent();
  }

  sendRoomChat(text: string) {
    if (!this.socket?.connected) return;
    this.socket.emit("room:chat", { text });
    this.incrementSent();
  }

  leaveRoom() {
    if (!this.socket?.connected) return;
    this.socket.emit("room:leave");
    this.incrementSent();
    this.setSnapshot({ roomState: null, roomError: null });
  }

  startRoomMatch() {
    if (!this.socket?.connected) return;
    this.socket.emit("room:start");
    this.incrementSent();
  }

  resetRoomSeries() {
    if (!this.socket?.connected) return;
    this.socket.emit("room:reset-series");
    this.incrementSent();
  }

  authenticateSession(username: string, avatar: string | null) {
    if (!this.socket?.connected) return;
    this.socket.emit("session:authenticate", { username, avatar });
    this.incrementSent();
  }

  clearRoomError() {
    this.setSnapshot({ roomError: null });
  }

  sendReady(matchId: string) {
    this.socket?.emit("match:ready", { matchId });
    this.incrementSent();
  }

  sendMatchMove(matchId: string, move: string) {
    if (!this.socket?.connected) {
      return;
    }

    this.matchMoveSequence += 1;
    this.socket.emit("match:move", {
      matchId,
      move,
      sequence: this.matchMoveSequence,
      sentAt: Date.now(),
    });
    this.incrementSent();
  }

  sendMatchFinish(matchId: string, moveCount: number) {
    this.socket?.emit("match:finish", { matchId, moveCount });
    this.incrementSent();
  }

  sendPlayAgain(matchId: string) {
    this.socket?.emit("match:play-again", { matchId });
    this.incrementSent();
  }

  sendReturnHome(matchId: string) {
    this.socket?.emit("match:return-home", { matchId });
    this.incrementSent();
    this.setSnapshot({ currentMatchId: null, opponentSocketId: null, queueStatus: "idle" });
  }

  sendCubeMove(move: string, scramble: string[]) {
    if (!this.socket?.connected) {
      return;
    }

    this.moveSequence += 1;
    this.socket.emit("cube:move", {
      move,
      scramble,
      sequence: this.moveSequence,
      sentAt: Date.now(),
    });
    this.incrementSent();
  }

  subscribe(listener: SnapshotListener) {
    this.snapshotListeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.snapshotListeners.delete(listener);
    };
  }

  onRemoteMove(listener: RemoteMoveListener) {
    this.remoteMoveListeners.add(listener);
    return () => {
      this.remoteMoveListeners.delete(listener);
    };
  }

  onMatchEvent<EventName extends keyof MatchEventPayloads>(
    eventName: EventName,
    listener: (payload: MatchEventPayloads[EventName]) => void,
  ) {
    const listeners = this.matchListeners[eventName] as Set<(payload: MatchEventPayloads[EventName]) => void>;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  getSnapshot() {
    return this.snapshot;
  }

  private handleMatchPayload(payload: MatchFoundPayload) {
    this.incrementReceived();
    this.matchMoveSequence = 0;
    this.setSnapshot({
      currentMatchId: payload.matchId,
      roomId: payload.roomId,
      opponentSocketId: payload.opponent?.socketId ?? null,
      queueStatus: "idle",
    });
  }

  private startPingLoop() {
    window.clearInterval(this.pingTimer);
    this.ping();
    this.pingTimer = window.setInterval(() => this.ping(), 3_000);
  }

  private ping() {
    if (!this.socket?.connected) {
      return;
    }

    const sentAt = performance.now();
    this.socket.emit("client:ping", { sentAt: Date.now() }, () => {
      this.setSnapshot({ pingMs: Math.round(performance.now() - sentAt) });
    });
    this.incrementSent();
  }

  private emitMatchEvent<EventName extends keyof MatchEventPayloads>(
    eventName: EventName,
    payload: MatchEventPayloads[EventName],
  ) {
    for (const listener of this.matchListeners[eventName] as Set<(value: MatchEventPayloads[EventName]) => void>) {
      listener(payload);
    }
  }

  private incrementSent() {
    this.setSnapshot({ eventsSent: this.snapshot.eventsSent + 1 });
  }

  private incrementReceived() {
    this.setSnapshot({ eventsReceived: this.snapshot.eventsReceived + 1 });
  }

  private setSnapshot(update: Partial<SocketDebugSnapshot>) {
    this.snapshot = {
      ...this.snapshot,
      ...update,
    };

    for (const listener of this.snapshotListeners) {
      listener(this.snapshot);
    }
  }
}

function getOrCreateClientId(): string {
  const saved = localStorage.getItem(CLIENT_ID_KEY);
  if (saved) {
    return saved;
  }

  const clientId = crypto.randomUUID();
  localStorage.setItem(CLIENT_ID_KEY, clientId);
  return clientId;
}

export const socketManager = new CubeRankedSocketManager();
