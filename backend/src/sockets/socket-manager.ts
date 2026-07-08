import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import type { FastifyInstance } from "fastify";
import { buildCorsOrigins } from "../config/cors.js";
import { validateSolve } from "../cube/cube-validator.js";

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
  flagged?: boolean;
  cheatReasons?: string[];
}

interface RoomPlayer {
  clientId: string;
  socketId: string;
  username: string;
  avatar: string | null;
  ready: boolean;
  connected: boolean;
  pingMs: number | null;
}

interface RoomSettings {
  puzzle: "3x3";
  gameType: "race";
  inspectionEnabled: boolean;
  bestOf: 1 | 3 | 5;
  scrambleVisibility: "hidden" | "visible";
  botFill: boolean;
}

interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
}

interface RoomState {
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
  disconnectTimer: NodeJS.Timeout | null;
  disconnectDeadlines: Map<string, number>;
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
  roomCode?: string;
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

  function createMatch(clientIds: string[], roomCode?: string) {
    const room = roomCode ? rooms.get(roomCode) : null;
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
      roomCode,
    };

    matches.set(matchId, match);

    for (const player of match.players) {
      const socket = getSocket(player.clientId);
      const opponent = getOpponent(match, player.clientId);

      void socket?.join(match.roomId);
      socket?.emit("match:found", buildMatchPayload(match, player.clientId, opponent));
    }

    if (room && room.spectator) {
      const specSocket = namespace.sockets.get(room.spectator.socketId);
      if (specSocket) {
        void specSocket.join(match.roomId);
        const host = match.players.find(p => p.clientId === room.host.clientId)!;
        const guest = match.players.find(p => p.clientId === room.guest!.clientId)!;
        specSocket.emit("match:found", {
          matchId: match.id,
          roomId: match.roomId,
          scrambleId: match.scrambleId,
          scramble: match.scramble,
          status: match.status,
          serverNow: Date.now(),
          startAt: match.startedAt,
          countdownAt: match.countdownAt,
          you: publicPlayer(host),
          opponent: publicPlayer(guest),
          isPrivate: true,
          isSpectator: true,
          inspectionEnabled: room.settings.inspectionEnabled,
          scrambleVisibility: room.settings.scrambleVisibility,
        });
      }
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
    const room = match.roomCode ? rooms.get(match.roomCode) : null;
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
      isPrivate: !!match.roomCode,
      inspectionEnabled: room ? room.settings.inspectionEnabled : true,
      scrambleVisibility: room ? room.settings.scrambleVisibility : "hidden",
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

    if (match.roomCode) {
      const room = rooms.get(match.roomCode);
      if (room) {
        if (winner) {
          room.scores[winner.clientId] = (room.scores[winner.clientId] || 0) + 1;
          const targetWins = Math.ceil(room.settings.bestOf / 2);
          if (room.scores[winner.clientId] >= targetWins) {
            room.winnerClientId = winner.clientId;
            room.status = "finished";
            addRoomSystemMessage(room, `Match series won by ${winner.username}!`);
          } else {
            room.host.ready = false;
            if (room.guest) room.guest.ready = false;
            room.status = "lobby";
            room.currentMatchId = null;
            addRoomSystemMessage(room, `Round won by ${winner.username}! Score: ${room.host.username} (${room.scores[room.host.clientId] || 0}) - ${room.guest?.username} (${room.scores[room.guest?.clientId || ""] || 0})`);
          }
        } else {
          room.host.ready = false;
          if (room.guest) room.guest.ready = false;
          room.status = "lobby";
          room.currentMatchId = null;
          addRoomSystemMessage(room, `Draw! Score remains: ${room.host.username} (${room.scores[room.host.clientId] || 0}) - ${room.guest?.username} (${room.scores[room.guest?.clientId || ""] || 0})`);
        }
        broadcastRoomState(room);
      }
    }
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

  const rooms = new Map<string, RoomState>();

  function findRoomByClientId(clientId: string): RoomState | null {
    for (const room of rooms.values()) {
      if (
        room.host.clientId === clientId ||
        room.guest?.clientId === clientId ||
        room.spectator?.clientId === clientId
      ) {
        return room;
      }
    }
    return null;
  }

  function broadcastRoomState(room: RoomState) {
    namespace.to(room.roomId).emit("room:state", {
      code: room.code,
      host: room.host,
      guest: room.guest,
      spectator: room.spectator,
      settings: room.settings,
      status: room.status,
      currentMatchId: room.currentMatchId,
      scores: room.scores,
      chat: room.chat,
      winnerClientId: room.winnerClientId,
    });
  }

  function addRoomSystemMessage(room: RoomState, text: string) {
    const message: ChatMessage = {
      id: randomUUID(),
      senderName: "System",
      text,
      timestamp: Date.now(),
    };
    room.chat.push(message);
    if (room.chat.length > 50) {
      room.chat.shift();
    }
    broadcastRoomState(room);
  }

  function hasAnyRoomDisconnects(room: RoomState): boolean {
    return room.disconnectDeadlines.size > 0;
  }

  function generateRoomCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function createUniqueRoomCode(): string {
    let code = generateRoomCode();
    while (rooms.has(code)) {
      code = generateRoomCode();
    }
    return code;
  }

  function handleRoomLeave(room: RoomState, clientId: string, socket: any) {
    void socket.leave(room.roomId);
    
    if (room.host.clientId === clientId) {
      addRoomSystemMessage(room, "Host left. Room closed.");
      namespace.to(room.roomId).emit("room:error", { message: "Host closed the room." });
      namespace.in(room.roomId).socketsLeave(room.roomId);
      rooms.delete(room.code);
    } else if (room.guest?.clientId === clientId) {
      room.guest = null;
      room.scores = {};
      room.status = "lobby";
      room.currentMatchId = null;
      room.winnerClientId = null;
      room.disconnectDeadlines.delete(clientId);
      addRoomSystemMessage(room, "Guest left the lobby");
      broadcastRoomState(room);
    } else if (room.spectator?.clientId === clientId) {
      room.spectator = null;
      room.disconnectDeadlines.delete(clientId);
      addRoomSystemMessage(room, "Spectator left");
      broadcastRoomState(room);
    }
  }

  function handleRoomDisconnectTimeout(room: RoomState, clientId: string) {
    const deadline = room.disconnectDeadlines.get(clientId);
    if (deadline && Date.now() >= deadline) {
      if (room.host.clientId === clientId) {
        addRoomSystemMessage(room, "Lobby closed: Host disconnected");
        namespace.to(room.roomId).emit("room:error", { message: "Host disconnected. Room closed." });
        namespace.in(room.roomId).socketsLeave(room.roomId);
        rooms.delete(room.code);
      } else if (room.guest?.clientId === clientId) {
        addRoomSystemMessage(room, `${room.guest.username} disconnected. Slot freed.`);
        room.guest = null;
        room.scores = {};
        room.status = "lobby";
        room.currentMatchId = null;
        room.winnerClientId = null;
        room.disconnectDeadlines.delete(clientId);
        broadcastRoomState(room);
      } else if (room.spectator?.clientId === clientId) {
        addRoomSystemMessage(room, "Spectator disconnected");
        room.spectator = null;
        room.disconnectDeadlines.delete(clientId);
        broadcastRoomState(room);
      }
    }
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

    const existingRoom = findRoomByClientId(session.clientId);
    if (existingRoom) {
      let player: RoomPlayer | null = null;
      if (existingRoom.host.clientId === session.clientId) {
        player = existingRoom.host;
      } else if (existingRoom.guest?.clientId === session.clientId) {
        player = existingRoom.guest;
      } else if (existingRoom.spectator?.clientId === session.clientId) {
        player = existingRoom.spectator;
      }

      if (player) {
        player.socketId = socket.id;
        player.connected = true;
        existingRoom.disconnectDeadlines.delete(session.clientId);
        
        if (existingRoom.disconnectTimer && !hasAnyRoomDisconnects(existingRoom)) {
          clearTimeout(existingRoom.disconnectTimer);
          existingRoom.disconnectTimer = null;
        }
        
        void socket.join(existingRoom.roomId);
        broadcastRoomState(existingRoom);
        addRoomSystemMessage(existingRoom, `${player.username} reconnected`);
      }
    }

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

      // Anti-Cheat validation foundation hook
      const cheatFlags: string[] = [];
      const elapsedMs = Date.now() - match.startedAt;

      // 1. Solve completion & scramble consistency check
      const isSolved = validateSolve(match.scramble, player.moves);
      if (!isSolved) {
        cheatFlags.push("INVALID_SOLVE_STATE");
      }

      // 2. Impossible timestamps
      if (elapsedMs < 900) {
        cheatFlags.push("IMPOSSIBLE_TIME");
      }

      // 3. Move count consistency
      if (player.moves.length < 5) {
        cheatFlags.push("TOO_FEW_MOVES");
      }

      // 4. Impossible TPS
      const tps = player.moves.length / Math.max(elapsedMs / 1_000, 0.001);
      if (tps > 32) {
        cheatFlags.push("IMPOSSIBLE_TPS");
      }

      if (cheatFlags.length > 0) {
        app.log.warn({
          matchId: match.id,
          clientId: player.clientId,
          username: player.username,
          cheatFlags,
          moves: player.moves,
          timeMs: elapsedMs,
          tps,
        }, "Anti-Cheat Hook: Suspicious solve flagged");
        
        player.flagged = true;
        player.cheatReasons = cheatFlags;
      }

      player.status = "finished";
      player.moveCount = Math.max(player.moveCount, payload.moveCount);
      player.finalTimeMs = elapsedMs;
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
      
      if (match.roomCode) {
        const room = rooms.get(match.roomCode);
        if (room) {
          room.status = "lobby";
          room.currentMatchId = null;
          room.host.ready = false;
          if (room.guest) room.guest.ready = false;
          broadcastRoomState(room);
          addRoomSystemMessage(room, `${player.username} left the match.`);
        }
      }
    });
    socket.on("room:create", () => {
      const existing = findRoomByClientId(session.clientId);
      if (existing) {
        handleRoomLeave(existing, session.clientId, socket);
      }

      const code = createUniqueRoomCode();
      const room: RoomState = {
        code,
        roomId: `room:${code}`,
        host: {
          clientId: session.clientId,
          socketId: socket.id,
          username: session.username,
          avatar: null,
          ready: false,
          connected: true,
          pingMs: null,
        },
        guest: null,
        spectator: null,
        settings: {
          puzzle: "3x3",
          gameType: "race",
          inspectionEnabled: true,
          bestOf: 1,
          scrambleVisibility: "hidden",
          botFill: false,
        },
        status: "lobby",
        currentMatchId: null,
        scores: {},
        chat: [],
        winnerClientId: null,
        disconnectTimer: null,
        disconnectDeadlines: new Map(),
      };

      rooms.set(code, room);
      void socket.join(room.roomId);
      broadcastRoomState(room);
      addRoomSystemMessage(room, `${session.username} created a private room`);
    });

    socket.on("room:join", (payload: { code: string }) => {
      const code = payload.code?.trim().toUpperCase();
      const room = rooms.get(code);

      if (!room) {
        socket.emit("room:error", { message: "Room not found" });
        return;
      }

      if (room.guest && room.guest.clientId !== session.clientId) {
        socket.emit("room:error", { message: "Room is full" });
        return;
      }

      if (room.status === "match" && (!room.guest || room.guest.clientId !== session.clientId)) {
        socket.emit("room:error", { message: "Room match is already in progress" });
        return;
      }

      if (room.guest && room.guest.clientId === session.clientId) {
        room.guest.socketId = socket.id;
        room.guest.connected = true;
        room.disconnectDeadlines.delete(session.clientId);
        if (room.disconnectTimer && !hasAnyRoomDisconnects(room)) {
          clearTimeout(room.disconnectTimer);
          room.disconnectTimer = null;
        }
      } else {
        room.guest = {
          clientId: session.clientId,
          socketId: socket.id,
          username: session.username,
          avatar: null,
          ready: false,
          connected: true,
          pingMs: null,
        };
      }

      void socket.join(room.roomId);
      broadcastRoomState(room);
      addRoomSystemMessage(room, `${session.username} joined the lobby`);
    });

    socket.on("room:spectate", (payload: { code: string }) => {
      const code = payload.code?.trim().toUpperCase();
      const room = rooms.get(code);

      if (!room) {
        socket.emit("room:error", { message: "Room not found" });
        return;
      }

      if (room.spectator && room.spectator.clientId !== session.clientId) {
        socket.emit("room:error", { message: "Spectator slot is full" });
        return;
      }

      if (room.spectator && room.spectator.clientId === session.clientId) {
        room.spectator.socketId = socket.id;
        room.spectator.connected = true;
        room.disconnectDeadlines.delete(session.clientId);
        if (room.disconnectTimer && !hasAnyRoomDisconnects(room)) {
          clearTimeout(room.disconnectTimer);
          room.disconnectTimer = null;
        }
      } else {
        room.spectator = {
          clientId: session.clientId,
          socketId: socket.id,
          username: session.username,
          avatar: null,
          ready: false,
          connected: true,
          pingMs: null,
        };
      }

      void socket.join(room.roomId);
      broadcastRoomState(room);
      addRoomSystemMessage(room, `${session.username} joined as a spectator`);
    });

    socket.on("room:ready", () => {
      const room = findRoomByClientId(session.clientId);
      if (!room || room.status === "match") return;

      if (room.host.clientId === session.clientId) {
        room.host.ready = !room.host.ready;
      } else if (room.guest?.clientId === session.clientId) {
        room.guest.ready = !room.guest.ready;
      }

      broadcastRoomState(room);
    });

    socket.on("room:settings", (settingsPayload: Partial<RoomSettings>) => {
      const room = findRoomByClientId(session.clientId);
      if (!room || room.host.clientId !== session.clientId || room.status === "match") return;

      room.settings = {
        ...room.settings,
        ...settingsPayload,
      };

      broadcastRoomState(room);
      addRoomSystemMessage(room, "Settings updated by host");
    });

    socket.on("room:chat", (payload: { text: string }) => {
      const room = findRoomByClientId(session.clientId);
      if (!room || !payload.text?.trim()) return;

      const message: ChatMessage = {
        id: randomUUID(),
        senderName: session.username,
        text: payload.text.slice(0, 140),
        timestamp: Date.now(),
      };

      room.chat.push(message);
      if (room.chat.length > 50) {
        room.chat.shift();
      }

      broadcastRoomState(room);
    });

    socket.on("room:leave", () => {
      const room = findRoomByClientId(session.clientId);
      if (room) {
        handleRoomLeave(room, session.clientId, socket);
      }
    });

    socket.on("room:start", () => {
      const room = findRoomByClientId(session.clientId);
      if (!room || room.host.clientId !== session.clientId || room.status === "match") return;

      if (!room.guest) {
        socket.emit("room:error", { message: "Cannot start match without a guest player" });
        return;
      }

      if (!room.host.ready || !room.guest.ready) {
        socket.emit("room:error", { message: "Both players must be ready to start" });
        return;
      }

      room.status = "match";
      broadcastRoomState(room);
      createMatch([room.host.clientId, room.guest.clientId], room.code);
    });

    socket.on("room:reset-series", () => {
      const room = findRoomByClientId(session.clientId);
      if (!room || room.host.clientId !== session.clientId || room.status !== "finished") return;

      room.scores = {};
      room.status = "lobby";
      room.winnerClientId = null;
      room.host.ready = false;
      if (room.guest) room.guest.ready = false;
      room.currentMatchId = null;

      broadcastRoomState(room);
      addRoomSystemMessage(room, "Series score reset by host");
    });

    socket.on("session:authenticate", (payload: { username: string; avatar: string | null }) => {
      session.username = payload.username;
      
      const room = findRoomByClientId(session.clientId);
      if (room) {
        if (room.host.clientId === session.clientId) {
          room.host.username = payload.username;
          room.host.avatar = payload.avatar;
        } else if (room.guest?.clientId === session.clientId) {
          room.guest.username = payload.username;
          room.guest.avatar = payload.avatar;
        } else if (room.spectator?.clientId === session.clientId) {
          room.spectator.username = payload.username;
          room.spectator.avatar = payload.avatar;
        }
        broadcastRoomState(room);
      }
      
      const match = session.matchId ? matches.get(session.matchId) : null;
      const player = match?.players.find((item) => item.clientId === session.clientId);
      if (player) {
        player.username = payload.username;
      }
      
      broadcastPresence();
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

      const room = findRoomByClientId(session.clientId);
      if (room) {
        let player: RoomPlayer | null = null;
        if (room.host.clientId === session.clientId) {
          player = room.host;
        } else if (room.guest?.clientId === session.clientId) {
          player = room.guest;
        } else if (room.spectator?.clientId === session.clientId) {
          player = room.spectator;
        }

        if (player) {
          player.connected = false;
          room.disconnectDeadlines.set(session.clientId, Date.now() + 60_000);
          broadcastRoomState(room);
          addRoomSystemMessage(room, `${player.username} disconnected`);

          if (room.disconnectTimer) {
            clearTimeout(room.disconnectTimer);
          }
          room.disconnectTimer = setTimeout(() => {
            handleRoomDisconnectTimeout(room, session.clientId);
          }, 60_000);
        }
      }

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
