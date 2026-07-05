import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import type { FastifyInstance } from "fastify";
import { buildCorsOrigins } from "../config/cors.js";

const SHARED_TEST_ROOM_ID = "shared-test-room";
const MATCH_ROOM_PREFIX = "match:";
const DISCONNECT_GRACE_MS = 30_000;
const COUNTDOWN_MS = 3_000;

type MatchStatus = "loading" | "countdown" | "playing" | "finished";
type PlayerStatus = "loading" | "ready" | "playing" | "finished" | "disconnected" | "forfeit";

interface ClientMovePayload {
  move: string;
  scramble: string[];
  sequence: number;
  sentAt: number;
}

interface MatchMovePayload {
  matchId: string;
  move: string;
  sequence: number;
  sentAt: number;
}

interface MatchFinishPayload {
  matchId: string;
  moveCount: number;
}

interface ClientSession {
  clientId: string;
  socketId: string;
  username: string;
  matchId: string | null;
  queuedAt: number | null;
}

interface MatchPlayer {
  clientId: string;
  socketId: string;
  username: string;
  ready: boolean;
  connected: boolean;
  status: PlayerStatus;
  moves: string[];
  moveCount: number;
  finalTimeMs: number | null;
  tps: number;
  pingMs: number | null;
  disconnectDeadlineAt: number | null;
  disconnectTimer: NodeJS.Timeout | null;
  playAgain: boolean;
}

interface MatchState {
  id: string;
  roomId: string;
  scrambleId: string;
  scramble: string[];
  status: MatchStatus;
  createdAt: number;
  countdownAt: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  players: MatchPlayer[];
}

const AXIS_BY_FACE: Record<string, "x" | "y" | "z"> = {
  R: "x",
  L: "x",
  U: "y",
  D: "y",
  F: "z",
  B: "z",
};

const FACES = ["R", "L", "U", "D", "F", "B"] as const;
const SUFFIXES = ["", "'", "2"] as const;

export function createSocketManager(app: FastifyInstance) {
  const io = new Server(app.server, {
    cors: {
      origin: buildCorsOrigins(app.env),
      credentials: true,
    },
    pingInterval: 8_000,
    pingTimeout: 7_000,
  });

  const namespace = io.of("/v1");
  const sessions = new Map<string, ClientSession>();
  const socketToClient = new Map<string, string>();
  const queue: string[] = [];
  const matches = new Map<string, MatchState>();

  function broadcastPresence() {
    namespace.emit("presence:update", {
      onlineCount: namespace.sockets.size,
      roomId: SHARED_TEST_ROOM_ID,
      connectedPlayers: namespace.sockets.size,
      timestamp: Date.now(),
    });
  }

  function getSocket(clientId: string) {
    const session = sessions.get(clientId);
    return session ? namespace.sockets.get(session.socketId) : undefined;
  }

  function emitQueueUpdates() {
    queue.forEach((clientId, index) => {
      const session = sessions.get(clientId);
      getSocket(clientId)?.emit("queue:update", {
        status: "searching",
        queuePosition: index + 1,
        elapsedMs: session?.queuedAt ? Date.now() - session.queuedAt : 0,
        estimatedWaitMs: queue.length > 1 ? 1_000 : 8_000,
      });
    });
  }

  function removeFromQueue(clientId: string) {
    const index = queue.indexOf(clientId);
    if (index !== -1) {
      queue.splice(index, 1);
    }

    const session = sessions.get(clientId);
    if (session) {
      session.queuedAt = null;
    }
  }

  function createMatch(clientIds: string[]) {
    const now = Date.now();
    const matchId = randomUUID();
    const match: MatchState = {
      id: matchId,
      roomId: `${MATCH_ROOM_PREFIX}${matchId}`,
      scrambleId: randomUUID(),
      scramble: generateWcaScramble(20),
      status: "loading",
      createdAt: now,
      countdownAt: null,
      startedAt: null,
      finishedAt: null,
      players: clientIds.map((clientId) => {
        const session = sessions.get(clientId);

        if (!session) {
          throw new Error(`Missing session for match player ${clientId}`);
        }

        session.matchId = matchId;
        session.queuedAt = null;

        return {
          clientId,
          socketId: session.socketId,
          username: session.username,
          ready: false,
          connected: true,
          status: "loading",
          moves: [],
          moveCount: 0,
          finalTimeMs: null,
          tps: 0,
          pingMs: null,
          disconnectDeadlineAt: null,
          disconnectTimer: null,
          playAgain: false,
        };
      }),
    };

    matches.set(matchId, match);

    for (const player of match.players) {
      const socket = getSocket(player.clientId);
      const opponent = getOpponent(match, player.clientId);

      void socket?.join(match.roomId);
      socket?.emit("match:found", buildMatchPayload(match, player.clientId, opponent));
    }
  }

  function tryCreateMatch() {
    while (queue.length >= 2) {
      const pair = queue.splice(0, 2).filter((clientId) => getSocket(clientId)?.connected);

      if (pair.length === 2) {
        createMatch(pair);
      } else if (pair.length === 1) {
        queue.unshift(pair[0]);
        break;
      }
    }

    emitQueueUpdates();
  }

  function getOpponent(match: MatchState, clientId: string) {
    return match.players.find((player) => player.clientId !== clientId) ?? null;
  }

  function buildMatchPayload(match: MatchState, clientId: string, opponent: MatchPlayer | null) {
    return {
      matchId: match.id,
      roomId: match.roomId,
      scrambleId: match.scrambleId,
      scramble: match.scramble,
      status: match.status,
      serverNow: Date.now(),
      startAt: match.startedAt,
      countdownAt: match.countdownAt,
      you: publicPlayer(match.players.find((player) => player.clientId === clientId)!),
      opponent: opponent ? publicPlayer(opponent) : null,
    };
  }

  function publicPlayer(player: MatchPlayer) {
    return {
      clientId: player.clientId,
      socketId: player.socketId,
      username: player.username,
      ready: player.ready,
      connected: player.connected,
      status: player.status,
      moveCount: player.moveCount,
      finalTimeMs: player.finalTimeMs,
      tps: player.tps,
      pingMs: player.pingMs,
      disconnectDeadlineAt: player.disconnectDeadlineAt,
      playAgain: player.playAgain,
    };
  }

  function emitMatchState(match: MatchState) {
    namespace.to(match.roomId).emit("match:state", {
      matchId: match.id,
      status: match.status,
      players: match.players.map(publicPlayer),
      serverNow: Date.now(),
    });
  }

  function startCountdown(match: MatchState) {
    if (match.status !== "loading" || !match.players.every((player) => player.ready && player.connected)) {
      return;
    }

    match.status = "countdown";
    match.countdownAt = Date.now();

    namespace.to(match.roomId).emit("match:countdown", {
      matchId: match.id,
      countdownAt: match.countdownAt,
      countdownMs: COUNTDOWN_MS,
      serverNow: Date.now(),
    });

    setTimeout(() => {
      if (!matches.has(match.id) || match.status !== "countdown") {
        return;
      }

      match.status = "playing";
      match.startedAt = Date.now();
      for (const player of match.players) {
        player.status = "playing";
      }

      namespace.to(match.roomId).emit("match:start", {
        matchId: match.id,
        startAt: match.startedAt,
        serverNow: Date.now(),
      });
      emitMatchState(match);
    }, COUNTDOWN_MS);
  }

  function finishMatchIfReady(match: MatchState) {
    if (match.status === "finished") {
      return;
    }

    const finished = match.players.every((player) => player.status === "finished" || player.status === "forfeit");
    if (!finished) {
      return;
    }

    match.status = "finished";
    match.finishedAt = Date.now();

    const winner = [...match.players]
      .filter((player) => player.status !== "forfeit" && player.finalTimeMs !== null)
      .sort((left, right) => left.finalTimeMs! - right.finalTimeMs!)[0]
      ?? match.players.find((player) => player.status !== "forfeit")
      ?? null;
    const loser = winner ? match.players.find((player) => player.clientId !== winner.clientId) ?? null : null;
    const timeDifferenceMs = winner && loser && winner.finalTimeMs !== null && loser.finalTimeMs !== null
      ? Math.abs(winner.finalTimeMs - loser.finalTimeMs)
      : null;

    namespace.to(match.roomId).emit("match:results", {
      matchId: match.id,
      scrambleId: match.scrambleId,
      scramble: match.scramble,
      winnerClientId: winner?.clientId ?? null,
      loserClientId: loser?.clientId ?? null,
      timeDifferenceMs,
      players: match.players.map(publicPlayer),
      serverNow: Date.now(),
    });
  }

  function forfeitPlayer(match: MatchState, player: MatchPlayer) {
    if (match.status === "finished") {
      return;
    }

    player.status = "forfeit";
    player.connected = false;
    player.finalTimeMs = null;
    player.disconnectDeadlineAt = null;
    player.disconnectTimer = null;

    for (const opponent of match.players.filter((item) => item.clientId !== player.clientId)) {
      if (opponent.status !== "finished") {
        opponent.status = "finished";
        opponent.finalTimeMs = match.startedAt ? Date.now() - match.startedAt : 0;
        opponent.tps = opponent.moveCount / Math.max((opponent.finalTimeMs ?? 1) / 1_000, 0.001);
      }
    }

    finishMatchIfReady(match);
  }

  namespace.on("connection", (socket) => {
    const requestedClientId = typeof socket.handshake.auth.clientId === "string"
      ? socket.handshake.auth.clientId
      : randomUUID();
    const existingSession = sessions.get(requestedClientId);
    const session: ClientSession = existingSession ?? {
      clientId: requestedClientId,
      socketId: socket.id,
      username: createGuestName(),
      matchId: null,
      queuedAt: null,
    };

    session.socketId = socket.id;
    sessions.set(session.clientId, session);
    socketToClient.set(socket.id, session.clientId);
    app.log.info({ socketId: socket.id, clientId: session.clientId }, "Socket connected");

    void socket.join(SHARED_TEST_ROOM_ID);

    socket.emit("server:ready", {
      version: app.env.APP_VERSION,
      socketId: socket.id,
      clientId: session.clientId,
      username: session.username,
      roomId: SHARED_TEST_ROOM_ID,
      timestamp: Date.now(),
    });

    const existingMatch = session.matchId ? matches.get(session.matchId) : null;
    const existingPlayer = existingMatch?.players.find((player) => player.clientId === session.clientId);
    if (existingMatch && existingPlayer && existingMatch.status !== "finished") {
      existingPlayer.socketId = socket.id;
      existingPlayer.connected = true;
      existingPlayer.disconnectDeadlineAt = null;
      existingPlayer.status = existingPlayer.ready ? existingPlayer.status : "loading";
      if (existingPlayer.disconnectTimer) {
        clearTimeout(existingPlayer.disconnectTimer);
        existingPlayer.disconnectTimer = null;
      }
      void socket.join(existingMatch.roomId);
      socket.emit("match:resume", buildMatchPayload(existingMatch, session.clientId, getOpponent(existingMatch, session.clientId)));
      socket.to(existingMatch.roomId).emit("match:opponent-reconnected", {
        matchId: existingMatch.id,
        player: publicPlayer(existingPlayer),
        serverNow: Date.now(),
      });
      emitMatchState(existingMatch);
    }

    broadcastPresence();

    socket.on("client:ping", (payload: { sentAt: number }, acknowledge?: (response: { sentAt: number; serverAt: number }) => void) => {
      acknowledge?.({
        sentAt: payload.sentAt,
        serverAt: Date.now(),
      });
    });

    socket.on("queue:join", () => {
      if (session.matchId && matches.get(session.matchId)?.status !== "finished") {
        return;
      }

      if (!queue.includes(session.clientId)) {
        session.queuedAt = Date.now();
        queue.push(session.clientId);
      }

      emitQueueUpdates();
      tryCreateMatch();
    });

    socket.on("queue:cancel", () => {
      removeFromQueue(session.clientId);
      socket.emit("queue:update", {
        status: "idle",
        queuePosition: null,
        elapsedMs: 0,
        estimatedWaitMs: null,
      });
      emitQueueUpdates();
    });

    socket.on("match:ready", (payload: { matchId: string }) => {
      const match = matches.get(payload.matchId);
      const player = match?.players.find((item) => item.clientId === session.clientId);
      if (!match || !player || match.status !== "loading") {
        return;
      }

      player.ready = true;
      player.status = "ready";
      emitMatchState(match);
      startCountdown(match);
    });

    socket.on("match:move", (payload: MatchMovePayload) => {
      const match = matches.get(payload.matchId);
      const player = match?.players.find((item) => item.clientId === session.clientId);
      if (!match || !player || match.status !== "playing") {
        return;
      }

      player.moves.push(payload.move);
      player.moveCount = player.moves.length;
      socket.to(match.roomId).emit("match:opponent-move", {
        matchId: match.id,
        move: payload.move,
        sequence: payload.sequence,
        socketId: socket.id,
        clientId: session.clientId,
        serverAt: Date.now(),
        synchronizationDelayMs: Math.max(0, Date.now() - payload.sentAt),
      });
    });

    socket.on("match:finish", (payload: MatchFinishPayload) => {
      const match = matches.get(payload.matchId);
      const player = match?.players.find((item) => item.clientId === session.clientId);
      if (!match || !player || match.status !== "playing" || !match.startedAt || player.status === "finished") {
        return;
      }

      player.status = "finished";
      player.moveCount = Math.max(player.moveCount, payload.moveCount);
      player.finalTimeMs = Date.now() - match.startedAt;
      player.tps = player.moveCount / Math.max(player.finalTimeMs / 1_000, 0.001);
      emitMatchState(match);
      finishMatchIfReady(match);
    });

    socket.on("match:play-again", (payload: { matchId: string }) => {
      const match = matches.get(payload.matchId);
      const player = match?.players.find((item) => item.clientId === session.clientId);
      if (!match || !player || match.status !== "finished") {
        return;
      }

      player.playAgain = true;
      namespace.to(match.roomId).emit("match:play-again-state", {
        matchId: match.id,
        players: match.players.map(publicPlayer),
        serverNow: Date.now(),
      });

      if (match.players.every((item) => item.playAgain && item.connected)) {
        const rematchPlayers = match.players.map((item) => item.clientId);
        matches.delete(match.id);
        createMatch(rematchPlayers);
      }
    });

    socket.on("match:return-home", (payload: { matchId: string }) => {
      const match = matches.get(payload.matchId);
      const player = match?.players.find((item) => item.clientId === session.clientId);
      if (!match || !player) {
        return;
      }

      session.matchId = null;
      player.playAgain = false;
      socket.leave(match.roomId);
      socket.to(match.roomId).emit("match:play-again-cancelled", {
        matchId: match.id,
        player: publicPlayer(player),
        serverNow: Date.now(),
      });
    });

    socket.on("cube:move", (payload: ClientMovePayload) => {
      socket.to(SHARED_TEST_ROOM_ID).emit("cube:move", {
        ...payload,
        socketId: socket.id,
        roomId: SHARED_TEST_ROOM_ID,
        serverAt: Date.now(),
      });
    });

    socket.on("disconnect", (reason) => {
      app.log.info({ socketId: socket.id, reason }, "Socket disconnected");
      socketToClient.delete(socket.id);
      removeFromQueue(session.clientId);

      const match = session.matchId ? matches.get(session.matchId) : null;
      const player = match?.players.find((item) => item.clientId === session.clientId);
      if (match && player && match.status !== "finished") {
        player.connected = false;
        player.status = "disconnected";
        player.disconnectDeadlineAt = Date.now() + DISCONNECT_GRACE_MS;
        socket.to(match.roomId).emit("match:opponent-disconnected", {
          matchId: match.id,
          player: publicPlayer(player),
          deadlineAt: player.disconnectDeadlineAt,
          serverNow: Date.now(),
        });
        player.disconnectTimer = setTimeout(() => forfeitPlayer(match, player), DISCONNECT_GRACE_MS);
      }

      broadcastPresence();
      emitQueueUpdates();
    });
  });

  return io;
}

function generateWcaScramble(length = 20): string[] {
  const scramble: string[] = [];
  const recentAxes: Array<"x" | "y" | "z"> = [];
  let previousFace = "";

  while (scramble.length < length) {
    const face = FACES[Math.floor(Math.random() * FACES.length)];
    const axis = AXIS_BY_FACE[face];

    if (face === previousFace) {
      continue;
    }

    if (recentAxes.length >= 2 && recentAxes.every((recentAxis) => recentAxis === axis)) {
      continue;
    }

    const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
    scramble.push(`${face}${suffix}`);
    previousFace = face;
    recentAxes.push(axis);

    if (recentAxes.length > 2) {
      recentAxes.shift();
    }
  }

  return scramble;
}

function createGuestName(): string {
  return `Guest${Math.floor(1_000 + Math.random() * 9_000)}`;
}
