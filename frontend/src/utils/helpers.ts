import { calculateStats, type SolveRecord } from "./sessionStats";
import type {
  MatchPlayerSnapshot,
  SocketConnectionState,
  RaceOpponentSnapshot,
} from "../network/socketTypes";
import type { TurnMode } from "../state/cubeStore";
import type { GameStage } from "../state/gameStateMachine";

interface BotRaceStats {
  wins: number;
  losses: number;
}

interface RaceResult {
  youTimeMs: number | null;
  botTimeMs: number | null;
  youMoveCount: number;
  botMoveCount: number;
  youTps: number;
  botTps: number;
  penalty: import("./sessionStats").Penalty;
  winner: "you" | "bot";
  timeDifferenceMs: number | null;
  botName: string;
  botDifficulty: string;
}

interface OnlineRaceResult {
  matchId: string;
  scrambleId: string;
  you: MatchPlayerSnapshot | null;
  opponent: MatchPlayerSnapshot | null;
  winnerClientId: string | null;
  loserClientId: string | null;
  timeDifferenceMs: number | null;
  ratingUpdates?: import("../network/socketTypes").RatingUpdate[];
}

type PlayableStage = Extract<GameStage, "COUNTDOWN" | "READY" | "INSPECTION" | "PLAYING" | "SOLVED" | "RESULT">;

export function buildCloudStatistics(history: SolveRecord[], botStats: BotRaceStats): import("../api/auth").UserStatistics {
  const stats = calculateStats(history);
  return {
    gamesPlayed: history.length + botStats.wins + botStats.losses,
    wins: botStats.wins,
    losses: botStats.losses,
    botWins: botStats.wins,
    botLosses: botStats.losses,
    bestTimeMs: stats.bestSolve?.finalTimeMs ?? null,
    averageTimeMs: stats.sessionAverageMs,
    practiceHistory: history.slice(0, 120),
  };
}

export function stateLabel(stage: PlayableStage): string {
  if (stage === "COUNTDOWN") return "READY";
  if (stage === "INSPECTION") return "INSPECT";
  if (stage === "PLAYING") return "SOLVING";
  if (stage === "SOLVED" || stage === "RESULT") return "SOLVED";
  return "READY";
}

export function connectionLabel(state: SocketConnectionState): string {
  if (state === "connecting") return "Connecting...";
  if (state === "connected") return "Connected";
  if (state === "reconnecting") return "Reconnecting...";
  return "Disconnected";
}

export function inverseTurnMode(mode: TurnMode): TurnMode {
  if (mode === "normal") return "prime";
  if (mode === "prime") return "normal";
  return "double";
}

export function snapshotToOpponent(player: MatchPlayerSnapshot): RaceOpponentSnapshot {
  return {
    id: player.clientId,
    source: "socket",
    name: player.username,
    avatar: player.username.slice(0, 2).toUpperCase(),
    avatarColor: player.connected ? "#14b8a6" : "#ef4444",
    difficultyLabel: player.connected ? "Online" : "Disconnected",
    status: player.status === "finished"
      ? "finished"
      : player.status === "disconnected" || player.status === "forfeit"
        ? "dnf"
        : player.status === "ready" || player.status === "loading"
          ? "ready"
          : "solving",
    elapsedMs: player.finalTimeMs ?? 0,
    finalTimeMs: player.finalTimeMs,
    moveCount: player.moveCount,
    pingMs: player.pingMs,
  };
}

export function resultToRaceResult(result: OnlineRaceResult): RaceResult {
  const youTimeMs = result.you?.finalTimeMs ?? null;
  const opponentTimeMs = result.opponent?.finalTimeMs ?? null;

  return {
    youTimeMs,
    botTimeMs: opponentTimeMs,
    youMoveCount: result.you?.moveCount ?? 0,
    botMoveCount: result.opponent?.moveCount ?? 0,
    youTps: result.you?.tps ?? 0,
    botTps: result.opponent?.tps ?? 0,
    penalty: result.you?.status === "forfeit" ? "DNF" : "none",
    winner: result.winnerClientId === result.you?.clientId ? "you" : "bot",
    timeDifferenceMs: result.timeDifferenceMs,
    botName: result.opponent?.username ?? "Opponent",
    botDifficulty: result.scrambleId.slice(0, 8),
  };
}
