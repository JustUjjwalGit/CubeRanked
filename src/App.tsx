import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  ChevronLeft,
  Clipboard,
  Copy,
  Gamepad2,
  Home as HomeIcon,
  Keyboard,
  Loader2,
  Lock,
  Moon,
  Play,
  RefreshCcw,
  RotateCcw,
  Settings,
  StepBack,
  StepForward,
  Sun,
  Trophy,
  User,
  Wifi,
  X,
} from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import CubeScene from "./components/cube/CubeScene";
import { makeMove, MOVE_FACES, parseMove, type Face } from "./lib/cubeEngine";
import { useBackendHealth } from "./hooks/useBackendHealth";
import { useSocketConnection } from "./hooks/useSocketConnection";
import {
  advanceAnimatedCube,
  createAnimatedCubeFromScramble,
  createBotOpponent,
  enqueueAnimatedMove,
  isAnimatedCubeSolved,
  statusText,
  type AnimatedCubeState,
  type BotOpponent,
  type RaceOpponentSnapshot,
} from "./lib/botRace";
import { generateWcaScramble, scrambleToString, type Penalty } from "./lib/scramble";
import {
  createSolveRecord,
  DEFAULT_SETTINGS,
  formatSolveTime,
  formatTime,
  type SessionSettings,
  type SolveRecord,
} from "./lib/sessionStats";
import {
  gameStateReducer,
  initialGameState,
  isPausableStage,
  isPracticeStage,
  type GameStage,
} from "./state/gameStateMachine";
import { useCubeStore, type TurnMode } from "./state/cubeStore";
import { socketManager } from "./network/socketManager";
import type {
  MatchFoundPayload,
  MatchPlayerSnapshot,
  MatchResultsPayload,
  QueueUpdatePayload,
  SocketConnectionState,
  SocketDebugSnapshot,
} from "./network/socketTypes";

const HISTORY_KEY = "cuberanked.practice.history";
const SETTINGS_KEY = "cuberanked.practice.settings";
const BEST_KEY = "cuberanked.practice.bestTimeMs";
const BOT_STATS_KEY = "cuberanked.botRace.stats";
const VERSION = "v0.3.0";

const turnModes: Array<{ mode: TurnMode; label: string }> = [
  { mode: "normal", label: "90" },
  { mode: "prime", label: "90'" },
  { mode: "double", label: "180" },
];

const playModes = [
  { title: "Practice", description: "Offline 3x3 trainer", available: true, mode: "practice" },
  { title: "Bot Race", description: "Race a human-like opponent", available: true, mode: "bot-race" },
  { title: "Ranked", description: "Find a live opponent", available: true, mode: "ranked" },
  { title: "Private Room", description: "Invite-only lobby", available: false, mode: "private-room" },
  { title: "Weekly Challenge", description: "Rotating official scramble", available: false, mode: "weekly" },
] as const;

type PlayableStage = Extract<GameStage, "COUNTDOWN" | "READY" | "INSPECTION" | "PLAYING" | "SOLVED" | "RESULT">;
type SettingsCategory = "General" | "Appearance" | "Controls" | "Cube" | "Graphics" | "Audio" | "Accessibility";

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
  penalty: Penalty;
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
}

export default function App() {
  const initialScramble = useRef(generateWcaScramble(20));
  const [gameState, dispatch] = useReducer(gameStateReducer, initialGameState);
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>("General");
  const [showScramble, setShowScramble] = useState(false);
  const [scramble, setScramble] = useState(initialScramble.current);
  const [settings, setSettings] = useState<SessionSettings>(loadSettings);
  const [solveHistory, setSolveHistory] = useState<SolveRecord[]>(loadHistory);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [inspectionElapsedMs, setInspectionElapsedMs] = useState(0);
  const [penalty, setPenalty] = useState<Penalty>("none");
  const [solveMoveCount, setSolveMoveCount] = useState(0);
  const [copyLabel, setCopyLabel] = useState("Copy Scramble");
  const [notice, setNotice] = useState<string | null>(null);
  const [lastSolve, setLastSolve] = useState<SolveRecord | null>(null);
  const [lastSolveIsPersonalBest, setLastSolveIsPersonalBest] = useState(false);
  const [countdownValue, setCountdownValue] = useState("3");
  const [botOpponent, setBotOpponent] = useState<BotOpponent | null>(null);
  const [opponentCube, setOpponentCube] = useState<AnimatedCubeState | null>(null);
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  const [botRaceStats, setBotRaceStats] = useState<BotRaceStats>(loadBotRaceStats);
  const [developerOverlayOpen, setDeveloperOverlayOpen] = useState(false);
  const [onlineOpponent, setOnlineOpponent] = useState<RaceOpponentSnapshot | null>(null);
  const [onlineOpponentCube, setOnlineOpponentCube] = useState<AnimatedCubeState | null>(null);
  const [queueUpdate, setQueueUpdate] = useState<QueueUpdatePayload>({ status: "idle", queuePosition: null, elapsedMs: 0, estimatedWaitMs: null });
  const [onlineMatch, setOnlineMatch] = useState<MatchFoundPayload | null>(null);
  const [onlinePlayers, setOnlinePlayers] = useState<MatchPlayerSnapshot[]>([]);
  const [onlineResult, setOnlineResult] = useState<OnlineRaceResult | null>(null);
  const solveStartRef = useRef(0);
  const inspectionStartRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const botMoveIndexRef = useRef(0);
  const raceFinishedRef = useRef(false);
  const onlineScrambleRef = useRef(scrambleToString(initialScramble.current));
  const onlineStartAtRef = useRef<number | null>(null);
  const serverClockOffsetRef = useRef(0);
  const onlineFinishSentRef = useRef(false);
  const backendHealth = useBackendHealth();
  const socketSnapshot = useSocketConnection();

  const cube = useCubeStore((state) => state.cube);
  const activeMove = useCubeStore((state) => state.activeMove);
  const moveQueue = useCubeStore((state) => state.moveQueue);
  const cubeMoveHistory = useCubeStore((state) => state.history);
  const redoStack = useCubeStore((state) => state.redoStack);
  const enqueuePracticeMove = useCubeStore((state) => state.enqueuePracticeMove);
  const setCubeFromScramble = useCubeStore((state) => state.setCubeFromScramble);
  const undoLast = useCubeStore((state) => state.undoLast);
  const redoLast = useCubeStore((state) => state.redoLast);
  const isSolved = useCubeStore((state) => state.isSolved);
  const turnMode = useCubeStore((state) => state.turnMode);
  const setTurnMode = useCubeStore((state) => state.setTurnMode);
  const turnDuration = useCubeStore((state) => state.turnDuration);
  const setTurnDuration = useCubeStore((state) => state.setTurnDuration);

  const stage = gameState.stage;
  const overlay = gameState.overlay;
  const gameMode = gameState.mode;
  const isBotRace = gameMode === "bot-race";
  const isRanked = gameMode === "ranked";
  const inspectionRemaining = Math.max(0, 15 - inspectionElapsedMs / 1_000);
  const cubeSolved = isSolved();

  const updateSettings = useCallback((next: Partial<SessionSettings>) => {
    setSettings((current) => ({ ...current, ...next }));
  }, []);

  const resetSolveState = useCallback((targetScramble = scramble) => {
    setCubeFromScramble(targetScramble);
    setElapsedMs(0);
    setInspectionElapsedMs(0);
    setPenalty("none");
    setSolveMoveCount(0);
    setRaceResult(null);
    raceFinishedRef.current = false;
    botMoveIndexRef.current = 0;
    solveStartRef.current = 0;
    inspectionStartRef.current = 0;
  }, [scramble, setCubeFromScramble]);

  const setupBotRace = useCallback((targetScramble: string[]) => {
    const bot = createBotOpponent(targetScramble);

    setBotOpponent(bot);
    setOpponentCube(createAnimatedCubeFromScramble(targetScramble));
    botMoveIndexRef.current = 0;
    raceFinishedRef.current = false;
  }, []);

  const resetOnlineSpectator = useCallback((targetScramble: string[]) => {
    setOnlineOpponent({
      id: "shared-room-peer",
      source: "socket",
      name: "Shared Room",
      avatar: "ON",
      avatarColor: "#14b8a6",
      difficultyLabel: "Sync Test",
      status: "ready",
      elapsedMs: 0,
      finalTimeMs: null,
      moveCount: 0,
    });
    onlineScrambleRef.current = scrambleToString(targetScramble);
    setOnlineOpponentCube(createAnimatedCubeFromScramble(targetScramble));
  }, []);

  const applyOnlineMatch = useCallback((match: MatchFoundPayload) => {
    const opponent = match.opponent;

    serverClockOffsetRef.current = Date.now() - match.serverNow;
    onlineStartAtRef.current = match.startAt;
    onlineFinishSentRef.current = false;
    onlineScrambleRef.current = scrambleToString(match.scramble);
    setOnlineMatch(match);
    setOnlinePlayers([match.you, ...(opponent ? [opponent] : [])]);
    setOnlineResult(null);
    setScramble(match.scramble);
    setCubeFromScramble(match.scramble);
    setElapsedMs(0);
    setSolveMoveCount(0);
    setPenalty("none");
    setOnlineOpponent(opponent ? snapshotToOpponent(opponent) : null);
    setOnlineOpponentCube(createAnimatedCubeFromScramble(match.scramble));
  }, [setCubeFromScramble]);

  const enterRankedQueue = useCallback(() => {
    setQueueUpdate({ status: "searching", queuePosition: null, elapsedMs: 0, estimatedWaitMs: 8_000 });
    setOnlineMatch(null);
    setOnlineResult(null);
    socketManager.joinQueue();
    dispatch({ type: "SELECT_RANKED" });
  }, []);

  const cancelRankedQueue = useCallback(() => {
    socketManager.cancelQueue();
    setQueueUpdate({ status: "idle", queuePosition: null, elapsedMs: 0, estimatedWaitMs: null });
    dispatch({ type: "QUEUE_CANCELLED" });
  }, []);

  const restartCurrentSolve = useCallback(() => {
    resetSolveState();
    if (isBotRace) {
      setupBotRace(scramble);
    }
    dispatch({ type: "RESTART_SOLVE" });
  }, [isBotRace, resetSolveState, scramble, setupBotRace]);

  const practiceAgain = useCallback(() => {
    if (isRanked && onlineMatch) {
      socketManager.sendPlayAgain(onlineMatch.matchId);
      setNotice("Waiting for opponent...");
      window.setTimeout(() => setNotice(null), 1_700);
      return;
    }

    resetSolveState();
    if (isBotRace) {
      setupBotRace(scramble);
    }
    dispatch({ type: "PRACTICE_AGAIN" });
  }, [isBotRace, isRanked, onlineMatch, resetSolveState, scramble, setupBotRace]);

  const requestNewScramble = useCallback(() => {
    setShowScramble(false);
    dispatch({ type: "NEW_SCRAMBLE" });
  }, []);

  const beginInspection = useCallback(() => {
    if (isBotRace || stage !== "READY" || overlay !== "NONE" || !settings.inspectionEnabled) {
      return;
    }

    resetSolveState();
    inspectionStartRef.current = performance.now();
    dispatch({ type: "START_INSPECTION" });
  }, [isBotRace, overlay, resetSolveState, settings.inspectionEnabled, stage]);

  const finishBotRace = useCallback((finalElapsedMs: number) => {
    if (!botOpponent || raceFinishedRef.current) {
      return;
    }

    raceFinishedRef.current = true;
    const playerTimeMs = finalElapsedMs;
    const botTimeMs = botOpponent.finalTimeMs ?? botOpponent.projectedTimeMs;
    const winner: "you" | "bot" = playerTimeMs <= botTimeMs ? "you" : "bot";
    const timeDifferenceMs = Math.abs(playerTimeMs - botTimeMs);
    const botMoveCount = botOpponent.plan.length;

    setElapsedMs(playerTimeMs);
    setBotOpponent((current) => current ? {
      ...current,
      status: "finished",
      finalTimeMs: current.finalTimeMs ?? botTimeMs,
      elapsedMs: current.finalTimeMs ?? botTimeMs,
      moveCount: current.moveCount || botMoveCount,
    } : current);
    setRaceResult({
      youTimeMs: playerTimeMs,
      botTimeMs,
      youMoveCount: solveMoveCount,
      botMoveCount,
      youTps: solveMoveCount / Math.max(playerTimeMs / 1_000, 0.001),
      botTps: botMoveCount / Math.max(botTimeMs / 1_000, 0.001),
      penalty,
      winner,
      timeDifferenceMs,
      botName: botOpponent.name,
      botDifficulty: botOpponent.difficultyLabel,
    });
    setBotRaceStats((current) => winner === "you"
      ? { ...current, wins: current.wins + 1 }
      : { ...current, losses: current.losses + 1 });
    solveStartRef.current = 0;
    dispatch({ type: "SOLVE_COMPLETE" });
  }, [botOpponent, penalty, solveMoveCount]);

  const finishSolve = useCallback((finalElapsedMs: number) => {
    if (isRanked && onlineMatch) {
      if (!onlineFinishSentRef.current) {
        onlineFinishSentRef.current = true;
        socketManager.sendMatchFinish(onlineMatch.matchId, solveMoveCount);
        setElapsedMs(finalElapsedMs);
      }
      return;
    }

    if (isBotRace) {
      finishBotRace(finalElapsedMs);
      return;
    }

    const record = createSolveRecord({
      rawTimeMs: finalElapsedMs,
      penalty,
      scramble,
      moveCount: solveMoveCount,
    });
    const bestBefore = solveHistory
      .filter((solve) => solve.finalTimeMs !== null)
      .sort((left, right) => left.finalTimeMs! - right.finalTimeMs!)[0];

    setLastSolve(record);
    setLastSolveIsPersonalBest(
      record.finalTimeMs !== null && (!bestBefore || record.finalTimeMs < bestBefore.finalTimeMs!),
    );
    setSolveHistory((current) => [record, ...current].slice(0, 120));
    setElapsedMs(finalElapsedMs);
    solveStartRef.current = 0;
    dispatch({ type: "SOLVE_COMPLETE" });
  }, [finishBotRace, isBotRace, isRanked, onlineMatch, penalty, scramble, solveHistory, solveMoveCount]);

  const startTimerForMove = useCallback(() => {
    if (overlay !== "NONE" || (stage !== "READY" && stage !== "INSPECTION" && stage !== "PLAYING")) {
      return false;
    }

    if ((isBotRace || isRanked) && stage !== "PLAYING") {
      return false;
    }

    if (stage === "INSPECTION") {
      const inspectionMs = performance.now() - inspectionStartRef.current;
      setPenalty(inspectionMs > 17_000 ? "DNF" : inspectionMs > 15_000 ? "+2" : "none");
    } else if (stage === "READY") {
      setPenalty("none");
    }

    if (stage !== "PLAYING") {
      solveStartRef.current = performance.now();
      setElapsedMs(0);
      setSolveMoveCount(0);
      dispatch({ type: "FIRST_MOVE" });
    }

    return true;
  }, [isBotRace, isRanked, overlay, stage]);

  const playFace = useCallback((face: Face, modeOverride?: TurnMode) => {
    if (!startTimerForMove()) {
      return;
    }

    const move = makeMove(face, modeOverride ?? turnMode);
    setSolveMoveCount((current) => (stage === "PLAYING" ? current + 1 : 1));
    enqueuePracticeMove(move);
    if (isRanked && onlineMatch) {
      socketManager.sendMatchMove(onlineMatch.matchId, move.notation);
    } else if (!isBotRace) {
      socketManager.sendCubeMove(move.notation, scramble);
    }
  }, [enqueuePracticeMove, isBotRace, isRanked, onlineMatch, scramble, stage, startTimerForMove, turnMode]);

  const tickOnlineOpponentCube = useCallback((deltaSeconds: number) => {
    setOnlineOpponentCube((current) => {
      if (!current) {
        return current;
      }

      return advanceAnimatedCube(current, deltaSeconds, settings.animationSpeed);
    });
  }, [settings.animationSpeed]);

  const undoPracticeMove = useCallback(() => {
    if (isBotRace || !isPracticeStage(stage) || overlay !== "NONE" || cubeMoveHistory.length === 0) {
      return;
    }

    if (stage === "PLAYING") {
      setSolveMoveCount((current) => current + 1);
    }

    undoLast();
  }, [cubeMoveHistory.length, isBotRace, overlay, stage, undoLast]);

  const redoPracticeMove = useCallback(() => {
    if (isBotRace || !isPracticeStage(stage) || overlay !== "NONE" || redoStack.length === 0) {
      return;
    }

    if (stage === "PLAYING") {
      setSolveMoveCount((current) => current + 1);
    }

    redoLast();
  }, [isBotRace, overlay, redoLast, redoStack.length, stage]);

  const copyScramble = async () => {
    await navigator.clipboard.writeText(scrambleToString(scramble));
    setCopyLabel("Copied");
    window.setTimeout(() => setCopyLabel("Copy Scramble"), 1_200);
  };

  const showComingSoon = (mode: string) => {
    setNotice(`${mode} Coming Soon`);
    window.setTimeout(() => setNotice(null), 1_700);
  };

  const showReplayNotice = () => {
    setNotice("Replay Coming Soon");
    window.setTimeout(() => setNotice(null), 1_700);
  };

  const returnHome = () => {
    if (onlineMatch) {
      socketManager.sendReturnHome(onlineMatch.matchId);
    }
    if (stage === "MATCHMAKING") {
      socketManager.cancelQueue();
    }
    setShowScramble(false);
    setOnlineMatch(null);
    setOnlineResult(null);
    onlineStartAtRef.current = null;
    onlineFinishSentRef.current = false;
    dispatch({ type: "BACK_HOME" });
  };

  const tickOpponentCube = useCallback((deltaSeconds: number) => {
    if (
      !isBotRace
      || !botOpponent
      || raceFinishedRef.current
      || overlay !== "NONE"
      || stage !== "PLAYING"
      || solveStartRef.current === 0
    ) {
      return;
    }

    const botElapsedMs = performance.now() - solveStartRef.current;

    setOpponentCube((current) => {
      if (!current) {
        return current;
      }

      let next = current;

      while (
        botMoveIndexRef.current < botOpponent.plan.length
        && botOpponent.plan[botMoveIndexRef.current].atMs <= botElapsedMs
      ) {
        next = enqueueAnimatedMove(next, botOpponent.plan[botMoveIndexRef.current].move);
        botMoveIndexRef.current += 1;
      }

      return advanceAnimatedCube(next, deltaSeconds, botOpponent.profile.turnDuration);
    });

    setBotOpponent((current) => {
      if (!current || current.status === "finished" || current.status === "dnf") {
        return current;
      }

      return {
        ...current,
        status: "solving",
        elapsedMs: botElapsedMs,
        moveCount: Math.max(current.moveCount, botMoveIndexRef.current),
      };
    });
  }, [botOpponent, isBotRace, overlay, stage]);

  useEffect(() => {
    setCubeFromScramble(scramble);
    setTurnDuration(settings.animationSpeed);
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(solveHistory));
    const best = solveHistory
      .filter((solve) => solve.finalTimeMs !== null)
      .sort((left, right) => left.finalTimeMs! - right.finalTimeMs!)[0];

    if (best) {
      localStorage.setItem(BEST_KEY, String(best.finalTimeMs));
    }
  }, [solveHistory]);

  useEffect(() => {
    localStorage.setItem(BOT_STATS_KEY, JSON.stringify(botRaceStats));
  }, [botRaceStats]);

  useEffect(() => {
    if (settings.animationSpeed !== turnDuration) {
      setTurnDuration(settings.animationSpeed);
    }
  }, [setTurnDuration, settings.animationSpeed, turnDuration]);

  useEffect(() => {
    if (stage !== "MATCH_LOADING") {
      return;
    }

    if (gameMode === "ranked") {
      setShowScramble(false);
      setElapsedMs(0);
      setInspectionElapsedMs(0);
      setPenalty("none");
      setSolveMoveCount(0);
      setLastSolve(null);
      setLastSolveIsPersonalBest(false);
      setRaceResult(null);
      raceFinishedRef.current = false;
      solveStartRef.current = 0;
      inspectionStartRef.current = 0;
      return;
    }

    const nextScramble = generateWcaScramble(20);
    setScramble(nextScramble);
    setCubeFromScramble(nextScramble);
    setShowScramble(false);
    setElapsedMs(0);
    setInspectionElapsedMs(0);
    setPenalty("none");
    setSolveMoveCount(0);
    setLastSolve(null);
    setLastSolveIsPersonalBest(false);
    setRaceResult(null);
    raceFinishedRef.current = false;
    botMoveIndexRef.current = 0;
    solveStartRef.current = 0;
    inspectionStartRef.current = 0;

    if (gameMode === "bot-race") {
      setupBotRace(nextScramble);
    } else {
      setBotOpponent(null);
      setOpponentCube(null);
      resetOnlineSpectator(nextScramble);
    }

    const timeout = window.setTimeout(() => {
      dispatch({ type: "LOADING_COMPLETE" });
    }, 1_000);

    return () => window.clearTimeout(timeout);
  }, [gameMode, gameState.loadingId, resetOnlineSpectator, setCubeFromScramble, setupBotRace, stage]);

  useEffect(() => {
    if (gameMode !== "practice") {
      return;
    }

    resetOnlineSpectator(scramble);
  }, [gameMode, resetOnlineSpectator, scramble]);

  useEffect(() => {
    const unsubscribeQueue = socketManager.onMatchEvent("queueUpdate", setQueueUpdate);
    const unsubscribeFound = socketManager.onMatchEvent("found", (payload) => {
      applyOnlineMatch(payload);
      dispatch({ type: "MATCH_FOUND" });
      window.setTimeout(() => socketManager.sendReady(payload.matchId), 450);
    });
    const unsubscribeResume = socketManager.onMatchEvent("resume", (payload) => {
      applyOnlineMatch(payload);
      dispatch({ type: "MATCH_FOUND" });
      if (payload.status === "playing" && payload.startAt) {
        onlineStartAtRef.current = payload.startAt;
        dispatch({ type: "COUNTDOWN_COMPLETE" });
      }
    });
    const unsubscribeState = socketManager.onMatchEvent("state", (payload) => {
      setOnlinePlayers(payload.players);
      const opponent = payload.players.find((player) => player.clientId !== socketSnapshot.clientId);
      if (opponent) {
        setOnlineOpponent(snapshotToOpponent(opponent));
      }
    });
    const unsubscribeCountdown = socketManager.onMatchEvent("countdown", (payload) => {
      serverClockOffsetRef.current = Date.now() - payload.serverNow;
      dispatch({ type: "START_COUNTDOWN" });
      setCountdownValue("3");

      const countdownEndAt = payload.countdownAt + payload.countdownMs;
      const updateCountdown = () => {
        const remainingMs = countdownEndAt - (Date.now() - serverClockOffsetRef.current);
        if (remainingMs > 2_000) setCountdownValue("3");
        else if (remainingMs > 1_000) setCountdownValue("2");
        else if (remainingMs > 0) setCountdownValue("1");
        else setCountdownValue("GO");
      };

      updateCountdown();
      const interval = window.setInterval(updateCountdown, 100);
      window.setTimeout(() => window.clearInterval(interval), payload.countdownMs + 700);
    });
    const unsubscribeStart = socketManager.onMatchEvent("start", (payload) => {
      serverClockOffsetRef.current = Date.now() - payload.serverNow;
      onlineStartAtRef.current = payload.startAt;
      onlineFinishSentRef.current = false;
      setElapsedMs(0);
      dispatch({ type: "COUNTDOWN_COMPLETE" });
    });
    const unsubscribeOpponentMove = socketManager.onMatchEvent("opponentMove", (payload) => {
      try {
        const move = parseMove(payload.move);
        setOnlineOpponent((current) => current ? {
          ...current,
          status: "solving",
          moveCount: current.moveCount + 1,
        } : current);
        setOnlineOpponentCube((current) => current ? enqueueAnimatedMove(current, move) : current);
      } catch {
        setNotice("Ignored opponent move");
        window.setTimeout(() => setNotice(null), 1_200);
      }
    });
    const unsubscribeDisconnected = socketManager.onMatchEvent("opponentDisconnected", (payload) => {
      setOnlineOpponent((current) => current ? {
        ...current,
        status: "dnf",
        difficultyLabel: "Disconnected",
      } : snapshotToOpponent(payload.player));
      setNotice("Opponent disconnected");
    });
    const unsubscribeReconnected = socketManager.onMatchEvent("opponentReconnected", (payload) => {
      setOnlineOpponent(snapshotToOpponent(payload.player));
      setNotice("Opponent reconnected");
      window.setTimeout(() => setNotice(null), 1_500);
    });
    const unsubscribePlayAgain = socketManager.onMatchEvent("playAgainState", (payload) => {
      setOnlinePlayers(payload.players);
    });
    const unsubscribePlayAgainCancelled = socketManager.onMatchEvent("playAgainCancelled", () => {
      setNotice("Opponent returned home");
      window.setTimeout(() => setNotice(null), 1_700);
    });
    const unsubscribeResults = socketManager.onMatchEvent("results", (payload) => {
      const you = payload.players.find((player) => player.clientId === socketSnapshot.clientId) ?? null;
      const opponent = payload.players.find((player) => player.clientId !== socketSnapshot.clientId) ?? null;
      const result: OnlineRaceResult = {
        matchId: payload.matchId,
        scrambleId: payload.scrambleId,
        you,
        opponent,
        winnerClientId: payload.winnerClientId,
        loserClientId: payload.loserClientId,
        timeDifferenceMs: payload.timeDifferenceMs,
      };

      setOnlineResult(result);
      setRaceResult(resultToRaceResult(result));
      setElapsedMs(you?.finalTimeMs ?? elapsedMs);
      dispatch({ type: "SOLVE_COMPLETE" });
    });

    return () => {
      unsubscribeQueue();
      unsubscribeFound();
      unsubscribeResume();
      unsubscribeState();
      unsubscribeCountdown();
      unsubscribeStart();
      unsubscribeOpponentMove();
      unsubscribeDisconnected();
      unsubscribeReconnected();
      unsubscribePlayAgain();
      unsubscribePlayAgainCancelled();
      unsubscribeResults();
    };
  }, [applyOnlineMatch, elapsedMs, socketSnapshot.clientId]);

  useEffect(() => {
    return socketManager.onRemoteMove((payload) => {
      if (gameMode !== "practice") {
        return;
      }

      try {
        const move = parseMove(payload.move);
        const remoteScrambleKey = scrambleToString(payload.scramble);

        setOnlineOpponent((current) => current ? {
          ...current,
          status: "solving",
          moveCount: current.moveCount + 1,
        } : current);
        setOnlineOpponentCube((current) => {
          const baseCube = remoteScrambleKey === onlineScrambleRef.current
            ? current
            : createAnimatedCubeFromScramble(payload.scramble);

          onlineScrambleRef.current = remoteScrambleKey;
          return baseCube ? enqueueAnimatedMove(baseCube, move) : baseCube;
        });
      } catch {
        setNotice("Ignored remote move");
        window.setTimeout(() => setNotice(null), 1_200);
      }
    });
  }, [gameMode]);

  useEffect(() => {
    if (stage !== "COUNTDOWN" || !isBotRace || overlay !== "NONE") {
      return;
    }

    setCountdownValue("3");
    setElapsedMs(0);
    setSolveMoveCount(0);
    setPenalty("none");
    solveStartRef.current = 0;
    botMoveIndexRef.current = 0;
    raceFinishedRef.current = false;
    setBotOpponent((current) => current ? {
      ...current,
      status: "inspection",
      elapsedMs: 0,
      finalTimeMs: null,
      moveCount: 0,
    } : current);

    const timeouts = [
      window.setTimeout(() => setCountdownValue("2"), 850),
      window.setTimeout(() => setCountdownValue("1"), 1_700),
      window.setTimeout(() => setCountdownValue("GO"), 2_550),
      window.setTimeout(() => {
        const now = performance.now();
        solveStartRef.current = now;
        setElapsedMs(0);
        setBotOpponent((current) => current ? { ...current, status: "solving" } : current);
        dispatch({ type: "COUNTDOWN_COMPLETE" });
      }, 3_050),
    ];

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [isBotRace, overlay, stage]);

  useEffect(() => {
    const shouldFreezeTimer = overlay !== "NONE" && (stage === "PLAYING" || stage === "INSPECTION");

    if (shouldFreezeTimer && pausedAtRef.current === null) {
      pausedAtRef.current = performance.now();
      return;
    }

    if (!shouldFreezeTimer && pausedAtRef.current !== null) {
      const pausedMs = performance.now() - pausedAtRef.current;

      if (stage === "PLAYING") {
        solveStartRef.current += pausedMs;
      } else if (stage === "INSPECTION") {
        inspectionStartRef.current += pausedMs;
      }

      pausedAtRef.current = null;
    }
  }, [overlay, stage]);

  useEffect(() => {
    if ((stage !== "PLAYING" && stage !== "INSPECTION") || overlay !== "NONE") {
      return;
    }

    let frame = 0;

    const update = () => {
      const now = performance.now();

      if (stage === "PLAYING") {
        if (isRanked && onlineStartAtRef.current && !onlineFinishSentRef.current) {
          setElapsedMs(Math.max(0, Date.now() - serverClockOffsetRef.current - onlineStartAtRef.current));
        } else if (solveStartRef.current > 0 && !onlineFinishSentRef.current) {
          setElapsedMs(now - solveStartRef.current);
        }
      } else {
        const inspectionMs = now - inspectionStartRef.current;
        setInspectionElapsedMs(inspectionMs);
        setPenalty(inspectionMs > 17_000 ? "DNF" : inspectionMs > 15_000 ? "+2" : "none");
      }

      frame = requestAnimationFrame(update);
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [isRanked, overlay, stage]);

  useEffect(() => {
    if (
      stage === "PLAYING"
      && overlay === "NONE"
      && solveMoveCount > 0
      && !activeMove
      && moveQueue.length === 0
      && cubeSolved
    ) {
      const finalElapsedMs = isRanked && onlineStartAtRef.current
        ? Math.max(0, Date.now() - serverClockOffsetRef.current - onlineStartAtRef.current)
        : performance.now() - solveStartRef.current;
      finishSolve(finalElapsedMs);
    }
  }, [activeMove, cube, cubeSolved, finishSolve, isRanked, moveQueue.length, overlay, solveMoveCount, stage]);

  useEffect(() => {
    if (
      !isBotRace
      || stage !== "PLAYING"
      || overlay !== "NONE"
      || !opponentCube
      || !botOpponent
      || botOpponent.status === "finished"
      || raceFinishedRef.current
    ) {
      return;
    }

    const botFinishedPlan = botMoveIndexRef.current >= botOpponent.plan.length;
    const botSolved = botFinishedPlan
      && !opponentCube.activeMove
      && opponentCube.moveQueue.length === 0
      && isAnimatedCubeSolved(opponentCube.cube);

    if (!botSolved) {
      return;
    }

    const finalTimeMs = performance.now() - solveStartRef.current;
    setBotOpponent((current) => current ? {
      ...current,
      status: "finished",
      elapsedMs: finalTimeMs,
      finalTimeMs,
      moveCount: botOpponent.plan.length,
    } : current);
  }, [botOpponent, isBotRace, opponentCube, overlay, stage]);

  useEffect(() => {
    if (stage !== "SOLVED" || overlay !== "NONE") {
      return;
    }

    const timeout = window.setTimeout(() => {
      dispatch({ type: "SHOW_RESULTS" });
    }, 950);

    return () => window.clearTimeout(timeout);
  }, [overlay, stage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      if (target?.matches("input, textarea, select")) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();

        if (overlay === "PAUSE_MENU") {
          dispatch({ type: "RESUME" });
        } else if (overlay !== "NONE") {
          dispatch({ type: "CLOSE_OVERLAY" });
        } else if (stage === "MODE_SELECT") {
          dispatch({ type: "CLOSE_MODE_SELECT" });
        } else if (stage === "MATCHMAKING") {
          cancelRankedQueue();
        } else if (isPausableStage(stage)) {
          dispatch({ type: "PAUSE" });
        }
        return;
      }

      if (event.key === "F9" && import.meta.env.DEV) {
        event.preventDefault();
        setDeveloperOverlayOpen((current) => !current);
        return;
      }

      if (overlay !== "NONE" || stage === "MODE_SELECT" || stage === "MATCH_LOADING" || stage === "RESULT") {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        beginInspection();
        return;
      }

      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        updateSettings({ hudVisible: !settings.hudVisible });
        return;
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        if (isPracticeStage(stage)) {
          requestNewScramble();
        }
        return;
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        redoPracticeMove();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoPracticeMove();
        return;
      }

      const key = event.key.toUpperCase();

      if (MOVE_FACES.includes(key as Face)) {
        event.preventDefault();
        playFace(key as Face, event.shiftKey ? inverseTurnMode(turnMode) : turnMode);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    beginInspection,
    cancelRankedQueue,
    overlay,
    playFace,
    redoPracticeMove,
    requestNewScramble,
    settings.hudVisible,
    stage,
    turnMode,
    undoPracticeMove,
    updateSettings,
  ]);

  return (
    <main className="client-shell">
      <AnimatePresence mode="wait">
        {stage === "HOME" || stage === "MODE_SELECT" ? (
          <HomeScreen
            key="home"
            connectionState={socketSnapshot.connectionState}
            onlineCount={socketSnapshot.onlineCount}
            onPlay={() => dispatch({ type: "OPEN_MODE_SELECT" })}
            onQuickPlay={() => dispatch({ type: "OPEN_MODE_SELECT" })}
            onContinuePractice={() => dispatch({ type: "SELECT_PRACTICE" })}
            onSettings={() => dispatch({ type: "OPEN_APP_SETTINGS" })}
            onProfile={() => showComingSoon("Profile")}
          />
        ) : stage === "MATCHMAKING" ? (
          <QueueScreen
            key="queue"
            queue={queueUpdate}
            connectionState={socketSnapshot.connectionState}
            onCancel={cancelRankedQueue}
          />
        ) : stage === "MATCH_LOADING" ? (
          <LoadingScreen key={`loading-${gameState.loadingId}`} mode={gameMode ?? "practice"} opponent={onlineMatch?.opponent?.username ?? null} />
        ) : (
          <PracticeScreen
            key="practice"
            stage={stage}
            mode={gameMode ?? "practice"}
            elapsedMs={elapsedMs}
            inspectionRemaining={inspectionRemaining}
            penalty={penalty}
            settings={settings}
            connectionState={socketSnapshot.connectionState}
            pingMs={socketSnapshot.pingMs}
            opponent={gameMode === "bot-race" ? botOpponent : onlineOpponent}
            opponentCube={gameMode === "bot-race" ? opponentCube : onlineOpponentCube}
            botRaceStats={botRaceStats}
            countdownValue={countdownValue}
            onOpponentFrame={gameMode === "bot-race" ? tickOpponentCube : tickOnlineOpponentCube}
            onHome={returnHome}
            onSettings={() => dispatch({ type: "OPEN_PRACTICE_SETTINGS" })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage === "MODE_SELECT" ? (
          <PlayModal
            onClose={() => dispatch({ type: "CLOSE_MODE_SELECT" })}
            onPractice={() => dispatch({ type: "SELECT_PRACTICE" })}
            onBotRace={() => dispatch({ type: "SELECT_BOT_RACE" })}
            onRanked={enterRankedQueue}
            onLockedMode={showComingSoon}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {overlay === "PRACTICE_SETTINGS" ? (
          <PracticeSettingsPopover
            mode={gameMode ?? "practice"}
            settings={settings}
            scramble={scramble}
            showScramble={showScramble}
            copyLabel={copyLabel}
            turnMode={turnMode}
            onClose={() => dispatch({ type: "CLOSE_OVERLAY" })}
            onGenerate={requestNewScramble}
            onReset={restartCurrentSolve}
            onUndo={undoPracticeMove}
            onRedo={redoPracticeMove}
            onReplay={showReplayNotice}
            onCopy={copyScramble}
            onToggleScramble={() => setShowScramble((current) => !current)}
            onSettings={updateSettings}
            onTurnMode={setTurnMode}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {overlay === "APP_SETTINGS" ? (
          <AppSettingsDialog
            category={settingsCategory}
            settings={settings}
            onCategory={setSettingsCategory}
            onClose={() => dispatch({ type: "CLOSE_OVERLAY" })}
            onSettings={updateSettings}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {overlay === "PAUSE_MENU" ? (
          <PauseMenu
            mode={gameMode ?? "practice"}
            onResume={() => dispatch({ type: "RESUME" })}
            onRestart={restartCurrentSolve}
            onSettings={() => dispatch({ type: "OPEN_APP_SETTINGS" })}
            onHome={returnHome}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {stage === "RESULT" ? (
          <ResultsModal
            solve={lastSolve}
            raceResult={raceResult}
            isPersonalBest={lastSolveIsPersonalBest}
            mode={gameMode ?? "practice"}
            onPracticeAgain={practiceAgain}
            onNewScramble={requestNewScramble}
            onHome={returnHome}
            onReplay={showReplayNotice}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {notice ? (
          <motion.div
            className="client-toast"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
          >
            {notice}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {developerOverlayOpen && import.meta.env.DEV ? (
          <DeveloperOverlay snapshot={socketSnapshot} />
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function HomeScreen({
  connectionState,
  onlineCount,
  onPlay,
  onQuickPlay,
  onContinuePractice,
  onSettings,
  onProfile,
}: {
  connectionState: SocketConnectionState;
  onlineCount: number;
  onPlay: () => void;
  onQuickPlay: () => void;
  onContinuePractice: () => void;
  onSettings: () => void;
  onProfile: () => void;
}) {
  return (
    <motion.section
      className="home-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="home-bg">
        <div className="client-grid" />
        <motion.div
          className="brand-orbit"
          animate={{ rotate: 360 }}
          transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <header className="home-topbar">
        <div className="launcher-brand">
          <img src="/CubeRankedLogo.png" alt="" aria-hidden="true" />
          <strong>CubeRanked</strong>
        </div>
        <nav className="launcher-nav" aria-label="Primary">
          <button type="button" className="selected">Home</button>
          <button type="button" onClick={onQuickPlay}>Play</button>
          <button type="button" onClick={onSettings}>Settings</button>
        </nav>
        <div className={`connection-pill connection-${connectionState}`}>
          <span />
          {connectionLabel(connectionState)}
        </div>
      </header>

      <div className="home-status-row">
        <div className="online-count-pill">
          {onlineCount.toLocaleString()} Players Online
        </div>
      </div>

      <div className="home-center">
        <motion.div
          className="launcher-copy"
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 130, damping: 20 }}
        >
          <span>Competitive 3x3 Client</span>
          <h1>Ready to race?</h1>
          <p>Queue online, practice offline, or warm up against a bot.</p>
        </motion.div>
        <motion.button
          type="button"
          className="play-button"
          onClick={onPlay}
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 130, damping: 20, delay: 0.08 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
        >
          <Play size={22} aria-hidden="true" />
          Play
        </motion.button>
        <motion.div
          className="quick-actions"
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 130, damping: 20, delay: 0.14 }}
        >
          <button type="button" onClick={onQuickPlay}>Quick Play</button>
          <button type="button" onClick={onContinuePractice}>Continue Practice</button>
        </motion.div>
      </div>

      <footer className="home-footer">
        <span>{VERSION}</span>
        <div className="home-actions">
          <button type="button" onClick={onSettings}>
            <Settings size={16} aria-hidden="true" />
            Settings
          </button>
          <button type="button" onClick={onProfile}>
            <User size={16} aria-hidden="true" />
            Profile
          </button>
        </div>
      </footer>
    </motion.section>
  );
}

function LoadingScreen({
  mode,
  opponent,
}: {
  mode: "practice" | "bot-race" | "ranked";
  opponent: string | null;
}) {
  const status = mode === "ranked"
    ? opponent
      ? `Opponent Found: ${opponent}`
      : "Preparing Match..."
    : "Generating Scramble...";

  return (
    <motion.section
      className="loading-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="home-bg">
        <div className="client-grid" />
      </div>
      <motion.div
        className="loading-card"
        initial={{ y: 18, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -12, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 160, damping: 22 }}
      >
        <img src="/CubeRankedLogo.png" alt="CubeRanked" />
        <Loader2 className="loading-spinner" size={28} aria-hidden="true" />
        <span>{status}</span>
        {mode === "ranked" ? <small>Loading cube... Synchronizing...</small> : null}
      </motion.div>
    </motion.section>
  );
}

function QueueScreen({
  queue,
  connectionState,
  onCancel,
}: {
  queue: QueueUpdatePayload;
  connectionState: SocketConnectionState;
  onCancel: () => void;
}) {
  const [localElapsedMs, setLocalElapsedMs] = useState(queue.elapsedMs);

  useEffect(() => {
    const startedAt = Date.now() - queue.elapsedMs;
    const interval = window.setInterval(() => {
      setLocalElapsedMs(Date.now() - startedAt);
    }, 100);

    return () => window.clearInterval(interval);
  }, [queue.elapsedMs]);

  return (
    <motion.section
      className="queue-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="home-bg">
        <div className="client-grid" />
      </div>
      <motion.div
        className="queue-card"
        initial={{ y: 18, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -12, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 160, damping: 22 }}
      >
        <img src="/CubeRankedLogo.png" alt="CubeRanked" />
        <div className="search-orbit">
          <Loader2 className="loading-spinner" size={30} aria-hidden="true" />
        </div>
        <span>Searching for opponent...</span>
        <div className="queue-grid">
          <div>
            <small>Elapsed</small>
            <strong>{formatTime(localElapsedMs)}</strong>
          </div>
          <div>
            <small>Estimated Wait</small>
            <strong>{queue.estimatedWaitMs === null ? "--" : formatTime(queue.estimatedWaitMs)}</strong>
          </div>
          <div>
            <small>Status</small>
            <strong>{connectionLabel(connectionState)}</strong>
          </div>
        </div>
        <button type="button" onClick={onCancel}>
          <X size={16} aria-hidden="true" />
          Cancel
        </button>
      </motion.div>
    </motion.section>
  );
}

function PlayModal({
  onClose,
  onPractice,
  onBotRace,
  onRanked,
  onLockedMode,
}: {
  onClose: () => void;
  onPractice: () => void;
  onBotRace: () => void;
  onRanked: () => void;
  onLockedMode: (mode: string) => void;
}) {
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        className="play-modal"
        initial={{ y: 30, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 170, damping: 20 }}
      >
        <div className="modal-head">
          <div>
            <span>Play</span>
            <h2>Select Mode</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close play menu">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="mode-grid">
          {playModes.map((mode) => (
            <button
              type="button"
              key={mode.title}
              className={mode.available ? "mode-card available" : "mode-card locked"}
              onClick={
                mode.mode === "practice"
                  ? onPractice
                  : mode.mode === "bot-race"
                    ? onBotRace
                    : mode.mode === "ranked"
                      ? onRanked
                      : () => onLockedMode(mode.title)
              }
            >
              <div className="mode-icon">
                {mode.available ? <Gamepad2 size={24} aria-hidden="true" /> : <Lock size={22} aria-hidden="true" />}
              </div>
              <strong>{mode.title}</strong>
              <span>{mode.description}</span>
              <small>{mode.available ? "Available" : "Locked"}</small>
            </button>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}

function PracticeScreen({
  stage,
  mode,
  elapsedMs,
  inspectionRemaining,
  penalty,
  settings,
  connectionState,
  pingMs,
  opponent,
  opponentCube,
  botRaceStats,
  countdownValue,
  onOpponentFrame,
  onHome,
  onSettings,
}: {
  stage: PlayableStage;
  mode: "practice" | "bot-race" | "ranked";
  elapsedMs: number;
  inspectionRemaining: number;
  penalty: Penalty;
  settings: SessionSettings;
  connectionState: SocketConnectionState;
  pingMs: number | null;
  opponent: RaceOpponentSnapshot | null;
  opponentCube: AnimatedCubeState | null;
  botRaceStats: BotRaceStats;
  countdownValue: string;
  onOpponentFrame: (deltaSeconds: number) => void;
  onHome: () => void;
  onSettings: () => void;
}) {
  const showFocusOnly = stage === "COUNTDOWN" || stage === "INSPECTION" || stage === "PLAYING" || stage === "SOLVED";
  const isBotRaceMode = mode === "bot-race";
  const isRankedMode = mode === "ranked";

  return (
    <motion.section
      className={`practice-screen stage-${stage.toLowerCase()} mode-${mode}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <CubeScene theme={settings.theme} />

      <div className="match-frame">
        {!showFocusOnly ? (
          <button type="button" className="back-button" onClick={onHome}>
            <ChevronLeft size={18} aria-hidden="true" />
            Home
          </button>
        ) : null}

        <div className="match-meta">
          <div className="mode-pill">
            <Gamepad2 size={16} aria-hidden="true" />
            {isRankedMode ? "Ranked" : isBotRaceMode ? "Bot Race" : "Practice"}
          </div>
          <div className="connection-pill practice">
            <Wifi size={15} aria-hidden="true" />
            {connectionLabel(connectionState)}
          </div>
          <div className="ping-pill">Ping: {pingMs === null ? "--" : pingMs} ms</div>
        </div>

        <div className="top-right-cluster">
          <CompactTimer
            stage={stage}
            elapsedMs={elapsedMs}
            inspectionRemaining={inspectionRemaining}
            penalty={penalty}
          />
          {!isRankedMode && (stage === "READY" || stage === "COUNTDOWN") ? (
            <button type="button" className="gear-button" onClick={onSettings} aria-label="Practice settings">
              <Settings size={19} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {opponent && opponentCube ? (
          <OpponentPanel
            opponent={opponent}
            opponentCube={opponentCube}
            theme={settings.theme}
            stats={botRaceStats}
            onFrame={onOpponentFrame}
          />
        ) : null}

        {settings.showKeyboardCheatSheet && (mode === "practice" || mode === "ranked") ? (
          <KeyboardCheatSheet />
        ) : null}
      </div>

      <AnimatePresence>
        {stage === "COUNTDOWN" ? (
          <CountdownOverlay value={countdownValue} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {stage === "READY" ? (
          <ReadyOverlay inspectionEnabled={settings.inspectionEnabled} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {stage === "INSPECTION" ? (
          <InspectionOverlay inspectionRemaining={inspectionRemaining} penalty={penalty} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {stage === "SOLVED" ? (
          <SolvedOverlay />
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}

function OpponentPanel({
  opponent,
  opponentCube,
  theme,
  stats,
  onFrame,
}: {
  opponent: RaceOpponentSnapshot;
  opponentCube: AnimatedCubeState;
  theme: "dark" | "light";
  stats: BotRaceStats;
  onFrame: (deltaSeconds: number) => void;
}) {
  return (
    <motion.aside
      className={`opponent-card status-${opponent.status}`}
      initial={{ x: 24, opacity: 0, scale: 0.98 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 24, opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 160, damping: 20 }}
    >
      <div className="opponent-head">
        <div className="opponent-avatar" style={{ background: opponent.avatarColor }}>
          {opponent.avatar}
        </div>
        <div>
          <strong>{opponent.name}</strong>
          <span>{opponent.difficultyLabel ?? "Opponent"}</span>
        </div>
      </div>

      <div className="opponent-cube-wrap">
        <CubeScene
          theme={theme}
          cube={opponentCube.cube}
          activeMove={opponentCube.activeMove}
          onFrame={onFrame}
          interactive={false}
          compact
        />
      </div>

      <div className="opponent-footer">
        <div>
          <span>{statusText(opponent.status)}</span>
          <strong>{formatTime(opponent.finalTimeMs ?? opponent.elapsedMs)}</strong>
        </div>
        <div>
          <span>{opponent.source === "bot" ? "Record" : "Ping"}</span>
          <strong>{opponent.source === "bot" ? `${stats.wins}-${stats.losses}` : opponent.pingMs === null || opponent.pingMs === undefined ? "-- ms" : `${opponent.pingMs} ms`}</strong>
        </div>
      </div>
    </motion.aside>
  );
}

function DeveloperOverlay({ snapshot }: { snapshot: SocketDebugSnapshot }) {
  const rows = [
    ["Socket ID", snapshot.socketId ?? "-"],
    ["Current Match ID", snapshot.currentMatchId ?? "-"],
    ["Opponent Socket ID", snapshot.opponentSocketId ?? "-"],
    ["Queue Status", snapshot.queueStatus],
    ["Connection", connectionLabel(snapshot.connectionState)],
    ["Current RTT", snapshot.pingMs === null ? "-- ms" : `${snapshot.pingMs} ms`],
    ["Sync Delay", snapshot.synchronizationDelayMs === null ? "-- ms" : `${snapshot.synchronizationDelayMs} ms`],
    ["Packets Sent", snapshot.eventsSent.toLocaleString()],
    ["Packets Received", snapshot.eventsReceived.toLocaleString()],
  ];

  return (
    <motion.aside
      className="developer-overlay"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
    >
      <div className="developer-title">
        <span>F9</span>
        Developer
      </div>
      {rows.map(([label, value]) => (
        <div className="developer-row" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </motion.aside>
  );
}

function CountdownOverlay({ value }: { value: string }) {
  return (
    <motion.div
      className="countdown-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.strong
        key={value}
        initial={{ scale: 0.74, opacity: 0, y: 18 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 1.16, opacity: 0, y: -18 }}
        transition={{ type: "spring", stiffness: 190, damping: 16 }}
      >
        {value}
      </motion.strong>
    </motion.div>
  );
}

function ReadyOverlay({ inspectionEnabled }: { inspectionEnabled: boolean }) {
  return (
    <motion.div
      className="ready-overlay"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.24 }}
    >
      <span>READY</span>
      <strong>{inspectionEnabled ? "Press Space to Inspect" : "Press First Move to Start"}</strong>
      {inspectionEnabled ? <small>or press first move to start</small> : null}
    </motion.div>
  );
}

function InspectionOverlay({
  inspectionRemaining,
  penalty,
}: {
  inspectionRemaining: number;
  penalty: Penalty;
}) {
  return (
    <motion.div
      className="inspection-overlay"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.24 }}
    >
      <span>INSPECTION</span>
      <strong>{inspectionRemaining.toFixed(1)}</strong>
      <small>{penalty === "none" ? "First move starts timer" : penalty}</small>
    </motion.div>
  );
}

function SolvedOverlay() {
  const confetti = Array.from({ length: 16 }, (_, index) => index);

  return (
    <motion.div
      className="solved-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <motion.div
        className="solved-glow"
        initial={{ scale: 0.72, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 150, damping: 18 }}
      />
      {confetti.map((item) => (
        <span key={item} style={{ "--burst-index": item } as CSSProperties} />
      ))}
      <motion.strong
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.08 }}
      >
        SOLVED
      </motion.strong>
    </motion.div>
  );
}

function CompactTimer({
  stage,
  elapsedMs,
  inspectionRemaining,
  penalty,
}: {
  stage: PlayableStage;
  elapsedMs: number;
  inspectionRemaining: number;
  penalty: Penalty;
}) {
  return (
    <motion.div
      className={`compact-timer phase-${stage.toLowerCase()}`}
      animate={{ y: stage === "PLAYING" ? -2 : 0 }}
      transition={{ type: "spring", stiffness: 190, damping: 18 }}
    >
      <span>{stateLabel(stage)}</span>
      <strong>{stage === "INSPECTION" ? inspectionRemaining.toFixed(1) : formatTime(elapsedMs)}</strong>
      {penalty !== "none" ? <small>{penalty}</small> : null}
    </motion.div>
  );
}

function ResultsModal({
  solve,
  raceResult,
  isPersonalBest,
  mode,
  onPracticeAgain,
  onNewScramble,
  onHome,
  onReplay,
}: {
  solve: SolveRecord | null;
  raceResult: RaceResult | null;
  isPersonalBest: boolean;
  mode: "practice" | "bot-race" | "ranked";
  onPracticeAgain: () => void;
  onNewScramble: () => void;
  onHome: () => void;
  onReplay: () => void;
}) {
  const isRace = (mode === "bot-race" || mode === "ranked") && raceResult;
  const isRankedRace = mode === "ranked" && raceResult;

  return (
    <motion.div
      className="modal-backdrop result-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        className="results-modal"
        initial={{ y: 26, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 26, opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 170, damping: 20 }}
      >
        <div className="result-kicker">
          <BadgeCheck size={17} aria-hidden="true" />
          {isRace ? "Race Complete" : "Solve Complete"}
        </div>
        <h2>{isRace ? (raceResult.winner === "you" ? "Victory" : "Defeat") : formatSolveTime(solve)}</h2>
        {isRace ? (
          <div className={raceResult.winner === "you" ? "personal-best" : "race-defeat"}>
            <Trophy size={16} aria-hidden="true" />
            {raceResult.winner === "you" ? "You Win" : `${raceResult.botName} Wins`}
          </div>
        ) : isPersonalBest ? (
          <div className="personal-best">
            <Trophy size={16} aria-hidden="true" />
            Personal Best
          </div>
        ) : null}

        {isRace ? (
          <>
            <div className="race-result-board">
              <div className={raceResult.winner === "you" ? "winner" : ""}>
                <span>You</span>
                <strong>{formatTime(raceResult.youTimeMs)}</strong>
                <small>{raceResult.youMoveCount} moves / {raceResult.youTps.toFixed(2)} TPS</small>
              </div>
              <div className={raceResult.winner === "bot" ? "winner" : ""}>
                <span>{raceResult.botName}</span>
                <strong>{formatTime(raceResult.botTimeMs)}</strong>
                <small>{raceResult.botMoveCount} moves / {raceResult.botTps.toFixed(2)} TPS</small>
              </div>
            </div>
            <div className="result-grid">
              <div>
                <span>Difference</span>
                <strong>{formatTime(raceResult.timeDifferenceMs)}</strong>
              </div>
              <div>
                <span>{isRankedRace ? "Scramble ID" : "Difficulty"}</span>
                <strong>{raceResult.botDifficulty}</strong>
              </div>
              <div>
                <span>Penalty</span>
                <strong>{raceResult.penalty === "none" ? "None" : raceResult.penalty}</strong>
              </div>
            </div>
          </>
        ) : (
          <div className="result-grid">
            <div>
              <span>Moves</span>
              <strong>{solve?.moveCount ?? "-"}</strong>
            </div>
            <div>
              <span>TPS</span>
              <strong>{solve ? solve.tps.toFixed(2) : "-"}</strong>
            </div>
            <div>
              <span>Penalty</span>
              <strong>{solve?.penalty === "none" ? "None" : solve?.penalty ?? "-"}</strong>
            </div>
          </div>
        )}

        <div className="result-actions">
          <button type="button" className="primary" onClick={onPracticeAgain}>
            <Play size={16} aria-hidden="true" />
            {isRankedRace ? "Play Again" : isRace ? "Race Again" : "Practice Again"}
          </button>
          {!isRankedRace ? <button type="button" onClick={onNewScramble}>
            <RefreshCcw size={16} aria-hidden="true" />
            New Scramble
          </button> : null}
          <button type="button" onClick={onHome}>
            <HomeIcon size={16} aria-hidden="true" />
            Back to Home
          </button>
          <button type="button" disabled onClick={onReplay}>
            <Play size={16} aria-hidden="true" />
            Replay
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}

function PauseMenu({
  mode,
  onResume,
  onRestart,
  onSettings,
  onHome,
}: {
  mode: "practice" | "bot-race" | "ranked";
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onHome: () => void;
}) {
  return (
    <motion.div
      className="modal-backdrop pause-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        className="pause-menu"
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 170, damping: 20 }}
      >
        <span>Paused</span>
        <h2>{mode === "ranked" ? "Ranked" : mode === "bot-race" ? "Bot Race" : "Practice"}</h2>
        <div className="pause-actions">
          <button type="button" className="primary" onClick={onResume}>
            <Play size={16} aria-hidden="true" />
            Resume
          </button>
          <button type="button" onClick={onRestart}>
            <RotateCcw size={16} aria-hidden="true" />
            Restart Solve
          </button>
          <button type="button" onClick={onSettings}>
            <Settings size={16} aria-hidden="true" />
            Settings
          </button>
          <button type="button" onClick={onHome}>
            <HomeIcon size={16} aria-hidden="true" />
            Return Home
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}

function PracticeSettingsPopover({
  mode,
  settings,
  scramble,
  showScramble,
  copyLabel,
  turnMode,
  onClose,
  onGenerate,
  onReset,
  onUndo,
  onRedo,
  onReplay,
  onCopy,
  onToggleScramble,
  onSettings,
  onTurnMode,
}: {
  mode: "practice" | "bot-race" | "ranked";
  settings: SessionSettings;
  scramble: string[];
  showScramble: boolean;
  copyLabel: string;
  turnMode: TurnMode;
  onClose: () => void;
  onGenerate: () => void;
  onReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReplay: () => void;
  onCopy: () => void;
  onToggleScramble: () => void;
  onSettings: (settings: Partial<SessionSettings>) => void;
  onTurnMode: (mode: TurnMode) => void;
}) {
  const isRace = mode === "bot-race";

  return (
    <motion.aside
      className="practice-popover"
      initial={{ x: 26, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 26, opacity: 0 }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
    >
      <div className="popover-head">
        <div>
          <span>{isRace ? "Bot Race" : "Practice"}</span>
          <h2>Settings</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close practice settings">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="popover-actions">
        <button type="button" onClick={onGenerate}><RefreshCcw size={16} />Generate New Scramble</button>
        <button type="button" onClick={onReset}><RotateCcw size={16} />{isRace ? "Restart Race" : "Reset Cube"}</button>
        {!isRace ? (
          <>
            <button type="button" onClick={onUndo}><StepBack size={16} />Undo</button>
            <button type="button" onClick={onRedo}><StepForward size={16} />Redo</button>
          </>
        ) : null}
        <button type="button" onClick={onReplay}><Play size={16} />Replay</button>
        <button type="button" onClick={onCopy}><Copy size={16} />{copyLabel}</button>
      </div>

      <button type="button" className="scramble-toggle" onClick={onToggleScramble}>
        <Clipboard size={16} aria-hidden="true" />
        {showScramble ? "Hide Scramble" : "Show Scramble"}
      </button>
      <AnimatePresence>
        {showScramble ? (
          <motion.div
            className="scramble-reveal"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {scrambleToString(scramble)}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="setting-block">
        <label className="switch-row compact">
          <span>Inspection</span>
          <input
            type="checkbox"
            checked={settings.inspectionEnabled}
            onChange={(event) => onSettings({ inspectionEnabled: event.target.checked })}
          />
        </label>
        <label className="switch-row compact">
          <span>Keyboard Cheat Sheet</span>
          <input
            type="checkbox"
            checked={settings.showKeyboardCheatSheet}
            onChange={(event) => onSettings({ showKeyboardCheatSheet: event.target.checked })}
          />
        </label>
        <label className="range-row compact">
          <span>Animation Speed</span>
          <input
            type="range"
            min="0.1"
            max="0.45"
            step="0.01"
            value={settings.animationSpeed}
            onChange={(event) => onSettings({ animationSpeed: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="segmented-control">
        <button
          type="button"
          className={settings.theme === "dark" ? "selected" : ""}
          onClick={() => onSettings({ theme: "dark" })}
        >
          <Moon size={15} />
          Dark
        </button>
        <button
          type="button"
          className={settings.theme === "light" ? "selected" : ""}
          onClick={() => onSettings({ theme: "light" })}
        >
          <Sun size={15} />
          Light
        </button>
      </div>

      <div className="segmented-control three">
        {turnModes.map((mode) => (
          <button
            key={mode.mode}
            type="button"
            className={turnMode === mode.mode ? "selected" : ""}
            onClick={() => onTurnMode(mode.mode)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="keyboard-rebinds">
        <div>
          <Keyboard size={16} />
          Keyboard Rebinds
        </div>
        <span>Coming Soon</span>
      </div>
    </motion.aside>
  );
}

function AppSettingsDialog({
  category,
  settings,
  onCategory,
  onClose,
  onSettings,
}: {
  category: SettingsCategory;
  settings: SessionSettings;
  onCategory: (category: SettingsCategory) => void;
  onClose: () => void;
  onSettings: (settings: Partial<SessionSettings>) => void;
}) {
  const categories: SettingsCategory[] = ["General", "Appearance", "Controls", "Cube", "Graphics", "Audio", "Accessibility"];

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        className="settings-dialog"
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 170, damping: 20 }}
      >
        <div className="modal-head">
          <div>
            <span>Application</span>
            <h2>Settings</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close settings">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="settings-layout">
          <nav className="settings-tabs">
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                className={category === item ? "selected" : ""}
                onClick={() => onCategory(item)}
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="settings-content">
            <h3>{category}</h3>
            {category === "Appearance" ? (
              <div className="segmented-control">
                <button
                  type="button"
                  className={settings.theme === "dark" ? "selected" : ""}
                  onClick={() => onSettings({ theme: "dark" })}
                >
                  <Moon size={15} />
                  Dark
                </button>
                <button
                  type="button"
                  className={settings.theme === "light" ? "selected" : ""}
                  onClick={() => onSettings({ theme: "light" })}
                >
                  <Sun size={15} />
                  Light
                </button>
              </div>
            ) : category === "Cube" || category === "Graphics" ? (
              <label className="range-row compact">
                <span>Animation Speed</span>
                <input
                  type="range"
                  min="0.1"
                  max="0.45"
                  step="0.01"
                  value={settings.animationSpeed}
                  onChange={(event) => onSettings({ animationSpeed: Number(event.target.value) })}
                />
              </label>
            ) : category === "Controls" ? (
              <>
                <label className="switch-row compact">
                  <span>Show Keyboard Cheat Sheet</span>
                  <input
                    type="checkbox"
                    checked={settings.showKeyboardCheatSheet}
                    onChange={(event) => onSettings({ showKeyboardCheatSheet: event.target.checked })}
                  />
                </label>
                <div className="keyboard-rebinds spacious">
                  <div>
                    <Keyboard size={16} />
                    Keyboard Rebinds
                  </div>
                  <span>Coming Soon</span>
                </div>
              </>
            ) : (
              <div className="settings-placeholder">
                {category} preferences will live here as the client grows.
              </div>
            )}
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

function KeyboardCheatSheet() {
  const rows: Array<[Face, string]> = [
    ["R", "Right"],
    ["L", "Left"],
    ["U", "Up"],
    ["D", "Down"],
    ["F", "Front"],
    ["B", "Back"],
  ];

  return (
    <motion.aside
      className="keyboard-cheat-sheet"
      initial={{ x: -16, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -16, opacity: 0 }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
    >
      <div>
        <Keyboard size={14} aria-hidden="true" />
        Controls
      </div>
      {rows.map(([face, label]) => (
        <span key={face}>
          <kbd>{face}</kbd>
          <strong>{label}</strong>
          <kbd>Shift+{face}</kbd>
          <strong>{label}'</strong>
        </span>
      ))}
    </motion.aside>
  );
}

function stateLabel(stage: PlayableStage): string {
  if (stage === "COUNTDOWN") return "READY";
  if (stage === "INSPECTION") return "INSPECT";
  if (stage === "PLAYING") return "SOLVING";
  if (stage === "SOLVED" || stage === "RESULT") return "SOLVED";
  return "READY";
}

function connectionLabel(state: SocketConnectionState): string {
  if (state === "connecting") return "Connecting...";
  if (state === "connected") return "Connected";
  if (state === "reconnecting") return "Reconnecting...";
  return "Disconnected";
}

function inverseTurnMode(mode: TurnMode): TurnMode {
  if (mode === "normal") return "prime";
  if (mode === "prime") return "normal";
  return "double";
}

function snapshotToOpponent(player: MatchPlayerSnapshot): RaceOpponentSnapshot {
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

function resultToRaceResult(result: OnlineRaceResult): RaceResult {
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

function loadSettings(): SessionSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<SessionSettings> | null;
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      animationSpeed: Number(saved?.animationSpeed ?? DEFAULT_SETTINGS.animationSpeed),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadHistory(): SolveRecord[] {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as SolveRecord[];
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function loadBotRaceStats(): BotRaceStats {
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
