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
  LogIn,
  LogOut,
  Moon,
  Play,
  RefreshCcw,
  RotateCcw,
  Send,
  Settings,
  Share2,
  StepBack,
  StepForward,
  Sun,
  Trophy,
  Tv,
  User,
  UserPlus,
  Users,
  Wifi,
  X,
  Award,
  Zap,
  Globe,
  GraduationCap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type FormEvent } from "react";
import CubeScene from "./components/cube/CubeScene";
import LearnMode from "./components/LearnMode";
import AppBackground from "./components/AppBackground";
import IdentityScreen from "./components/IdentityScreen";
import RankedGateModal from "./components/RankedGateModal";
import RankPromotionAnimation from "./components/RankPromotionAnimation";
import SocialSidebar from "./components/SocialSidebar";
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
  calculateStats,
  DEFAULT_SETTINGS,
  formatSolveTime,
  formatTime,
  type SessionSettings,
  type SolveRecord,
} from "./lib/sessionStats";
import { getRankFromRating } from "./lib/ranks";
import { saveReplay, getLocalReplays } from "./lib/replay";
import { calculateLifetimeStats } from "./lib/statsEngine";
import {
  gameStateReducer,
  initialGameState,
  isPausableStage,
  isPracticeStage,
  type GameStage,
  type GameMode,
} from "./state/gameStateMachine";
import { useCubeStore, type TurnMode } from "./state/cubeStore";
import { socketManager } from "./network/socketManager";
import { useAuth } from "./auth/AuthContext";
import type { UserProfile, UserStatistics } from "./lib/authApi";
import { audioManager } from "./lib/audioManager";
import type {
  MatchFoundPayload,
  MatchPlayerSnapshot,
  MatchResultsPayload,
  QueueUpdatePayload,
  SocketConnectionState,
  SocketDebugSnapshot,
  RoomState,
  RoomSettings,
  ChatMessage,
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
  { title: "Private Room", description: "Invite-only lobby", available: true, mode: "private" },
  { title: "Weekly Challenge", description: "Rotating official scramble", available: false, mode: "weekly" },
] as const;

type PlayableStage = Extract<GameStage, "COUNTDOWN" | "READY" | "INSPECTION" | "PLAYING" | "SOLVED" | "RESULT">;
type SettingsCategory = "General" | "Appearance" | "Camera" | "Controls" | "Cube" | "Graphics" | "Audio" | "Accessibility";
type AuthModal = "none" | "login" | "register" | "profile";

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
  ratingUpdates?: import("./network/socketTypes").RatingUpdate[];
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
  const replayMovesRef = useRef<Array<{ move: string; timeOffsetMs: number }>>([]);
  const countdownIntervalRef = useRef<number | null>(null);
  const countdownTimeoutRef = useRef<number | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);
  const [lifetimeStats, setLifetimeStats] = useState(() => calculateLifetimeStats(getLocalReplays()));

  const showNotice = useCallback((text: string, durationMs?: number) => {
    setNotice(text);
    if (noticeTimeoutRef.current !== null) {
      window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
    if (durationMs !== undefined) {
      noticeTimeoutRef.current = window.setTimeout(() => {
        setNotice(null);
        noticeTimeoutRef.current = null;
      }, durationMs);
    }
  }, []);

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
  const [authModal, setAuthModal] = useState<AuthModal>("none");
  const [rankedGateOpen, setRankedGateOpen] = useState(false);
  const [promotionData, setPromotionData] = useState<{ rank: import("./lib/ranks").RankInfo, isPromotion: boolean } | null>(null);
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
  const auth = useAuth();

  const guestProfile = useMemo<UserProfile>(() => {
    const validSolves = solveHistory.filter(s => s.finalTimeMs !== null);
    const pbTime = validSolves.length > 0 ? Math.min(...validSolves.map(s => s.finalTimeMs!)) : null;
    return {
      id: "guest",
      username: auth.guestUsername,
      email: "",
      avatar: null,
      country: null,
      bio: "Local Guest Profile. Upgrade to unlock competitive ranks!",
      theme: settings.theme,
      favoriteMode: "Practice",
      status: "online",
      joinDate: new Date().toISOString(),
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      botWins: botRaceStats.wins,
      botLosses: botRaceStats.losses,
      bestTimeMs: pbTime,
      averageTimeMs: null,
      settings,
      statistics: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        botWins: botRaceStats.wins,
        botLosses: botRaceStats.losses,
        bestTimeMs: pbTime,
        averageTimeMs: null,
        practiceHistory: solveHistory,
      }
    };
  }, [auth.guestUsername, settings, solveHistory, botRaceStats]);

  // Automatically merge local guest data when upgrading to an authenticated account
  const prevAuthModeRef = useRef(auth.mode);
  useEffect(() => {
    const prevMode = prevAuthModeRef.current;
    const currentMode = auth.mode;
    prevAuthModeRef.current = currentMode;

    if (prevMode === "guest" && currentMode === "authenticated" && auth.user) {
      // 1. Transfer Settings (Keybindings, HUD, animations)
      void auth.syncSettings(settings).catch(console.error);

      // 2. Transfer Statistics (Practice PBs, Bot stats)
      const validSolves = solveHistory.filter(s => s.finalTimeMs !== null);
      const pbTime = validSolves.length > 0 ? Math.min(...validSolves.map(s => s.finalTimeMs!)) : null;

      const mergedStats = {
        gamesPlayed: auth.user.statistics?.gamesPlayed || 0,
        wins: auth.user.statistics?.wins || 0,
        losses: auth.user.statistics?.losses || 0,
        botWins: Math.max(auth.user.statistics?.botWins || 0, botRaceStats.wins),
        botLosses: Math.max(auth.user.statistics?.botLosses || 0, botRaceStats.losses),
        bestTimeMs: pbTime !== null 
          ? (auth.user.statistics?.bestTimeMs !== null 
              ? Math.min(auth.user.statistics!.bestTimeMs!, pbTime) 
              : pbTime)
          : (auth.user.statistics?.bestTimeMs || null),
        averageTimeMs: auth.user.statistics?.averageTimeMs || null,
        practiceHistory: solveHistory.slice(0, 50),
      };

      void auth.syncStatistics(mergedStats).catch(console.error);
      showNotice("Guest local profile, settings and statistics merged successfully!", 3000);
    }
  }, [auth.mode, auth.user, settings, solveHistory, botRaceStats, showNotice]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get("room");
    if (roomCode) {
      window.history.replaceState({}, document.title, window.location.pathname);
      dispatch({ type: "SELECT_PRIVATE" });
      
      const checkAndJoin = () => {
        if (socketManager.getSnapshot().connectionState === "connected") {
          socketManager.joinRoom(roomCode);
        } else {
          window.setTimeout(checkAndJoin, 200);
        }
      };
      checkAndJoin();
    }
  }, []);

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

  // Synchronize client activity with the socket presence server based on game stage
  useEffect(() => {
    if (socketSnapshot.connectionState !== "connected") return;

    if (stage === "MATCHMAKING") {
      socketManager.updateActivity("queue");
    } else if (stage === "READY" || stage === "INSPECTION" || stage === "PLAYING" || stage === "SOLVED") {
      if (gameMode === "practice" || gameMode === "bot-race") {
        socketManager.updateActivity("practice");
      } else {
        socketManager.updateActivity("match");
      }
    } else {
      socketManager.updateActivity("online");
    }
  }, [stage, gameMode, socketSnapshot.connectionState]);
  const isBotRace = gameMode === "bot-race";
  const isRanked = gameMode === "ranked";
  const inspectionRemaining = Math.max(0, 15 - inspectionElapsedMs / 1_000);
  const cubeSolved = isSolved();
  const effectiveInspectionEnabled = gameMode === "private" && socketSnapshot.roomState 
    ? socketSnapshot.roomState.settings.inspectionEnabled 
    : settings.inspectionEnabled;

  const updateSettings = useCallback((next: Partial<SessionSettings>) => {
    if (next.theme !== undefined) {
      audioManager.playThemeSwitch();
    }
    setSettings((current) => ({ ...current, ...next }));
  }, []);

  const handleAuthError = useCallback((error: unknown) => {
    showNotice(error instanceof Error ? error.message : "Authentication failed", 2200);
  }, [showNotice]);

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
    // Gate guests — must be authenticated to enter ranked
    if (auth.mode === "guest") {
      setRankedGateOpen(true);
      return;
    }
    setQueueUpdate({ status: "searching", queuePosition: null, elapsedMs: 0, estimatedWaitMs: 8_000 });
    setOnlineMatch(null);
    setOnlineResult(null);
    socketManager.joinQueue();
    dispatch({ type: "SELECT_RANKED" });
  }, [auth.mode]);

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
    if (isBotRace || stage !== "READY" || overlay !== "NONE" || !effectiveInspectionEnabled) {
      return;
    }

    resetSolveState();
    inspectionStartRef.current = performance.now();
    audioManager.playInspectionStart();
    dispatch({ type: "START_INSPECTION" });
  }, [isBotRace, overlay, resetSolveState, effectiveInspectionEnabled, stage]);

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

    const matchId = `bot-${Date.now()}`;
    const inspectionTimeMs = inspectionStartRef.current > 0 && solveStartRef.current > 0
      ? Math.max(0, Math.round(solveStartRef.current - inspectionStartRef.current))
      : 0;
    saveReplay({
      replayId: `replay-${matchId}`,
      matchId,
      gameMode: "bot-race",
      scramble,
      startedAt: new Date().toISOString(),
      durationMs: playerTimeMs,
      inspectionTimeMs,
      penalty,
      result: penalty === "DNF" ? "DNF" : "SOLVED",
      won: winner === "you",
      puzzle: "3x3",
      moves: [...replayMovesRef.current],
    });
    setLifetimeStats(calculateLifetimeStats(getLocalReplays()));

    solveStartRef.current = 0;
    dispatch({ type: "SOLVE_COMPLETE" });
  }, [botOpponent, penalty, scramble, solveMoveCount]);

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

    const inspectionTimeMs = inspectionStartRef.current > 0 && solveStartRef.current > 0
      ? Math.max(0, Math.round(solveStartRef.current - inspectionStartRef.current))
      : 0;
    saveReplay({
      replayId: `replay-${record.id}`,
      matchId: record.id,
      gameMode: "practice",
      scramble,
      startedAt: new Date().toISOString(),
      durationMs: record.finalTimeMs ?? finalElapsedMs,
      inspectionTimeMs,
      penalty,
      result: penalty === "DNF" ? "DNF" : "SOLVED",
      puzzle: "3x3",
      moves: [...replayMovesRef.current],
    });
    setLifetimeStats(calculateLifetimeStats(getLocalReplays()));

    setElapsedMs(finalElapsedMs);
    solveStartRef.current = 0;
    audioManager.playSolveComplete();
    dispatch({ type: "SOLVE_COMPLETE" });
  }, [finishBotRace, isBotRace, isRanked, onlineMatch, penalty, scramble, solveHistory, solveMoveCount]);

  const startTimerForMove = useCallback(() => {
    if (overlay !== "NONE" || (stage !== "READY" && stage !== "INSPECTION" && stage !== "PLAYING")) {
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
      replayMovesRef.current = [];
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

    const solveStartedJustNow = stage !== "PLAYING";
    const timeOffsetMs = solveStartedJustNow ? 0 : (solveStartRef.current > 0 ? (performance.now() - solveStartRef.current) : 0);
    replayMovesRef.current.push({
      move: move.notation,
      timeOffsetMs: Math.round(timeOffsetMs),
    });
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
    if (stage === "PRIVATE_LOBBY") {
      socketManager.leaveRoom();
      setShowScramble(false);
      setOnlineMatch(null);
      setOnlineResult(null);
      onlineStartAtRef.current = null;
      onlineFinishSentRef.current = false;
      dispatch({ type: "BACK_HOME" });
      return;
    }

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

    if (gameMode === "private") {
      dispatch({ type: "SELECT_PRIVATE" });
    } else {
      dispatch({ type: "BACK_HOME" });
    }
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
    if (auth.mode !== "authenticated" || !auth.user) {
      return;
    }

    setSettings((current) => ({ ...current, ...auth.user!.settings }));
    setSolveHistory(Array.isArray(auth.user.statistics.practiceHistory) ? auth.user.statistics.practiceHistory : []);
    setBotRaceStats({
      wins: auth.user.statistics.botWins,
      losses: auth.user.statistics.botLosses,
    });
  }, [auth.mode, auth.user?.id]);

  useEffect(() => {
    if (socketSnapshot.connectionState === "connected") {
      if (auth.mode === "authenticated" && auth.user) {
        socketManager.authenticateSession(auth.user.id, auth.user.username, auth.user.avatar);
        socketManager.syncSocialData();
      } else if (auth.mode === "guest") {
        socketManager.authenticateSession(auth.guestUsername, auth.guestUsername, null);
        socketManager.syncSocialData();
      }
    }
  }, [auth.mode, auth.user?.id, auth.user?.username, auth.user?.avatar, auth.guestUsername, socketSnapshot.connectionState]);

  useEffect(() => {
    if (auth.mode !== "authenticated") {
      return;
    }

    const timeout = window.setTimeout(() => {
      void auth.syncSettings(settings).catch(() => undefined);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [auth.mode, auth.syncSettings, settings]);

  useEffect(() => {
    if (auth.mode !== "authenticated") {
      return;
    }

    const timeout = window.setTimeout(() => {
      void auth.syncStatistics(buildCloudStatistics(solveHistory, botRaceStats)).catch(() => undefined);
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [auth.mode, auth.syncStatistics, botRaceStats, solveHistory]);

  useEffect(() => {
    if (settings.animationSpeed !== turnDuration) {
      setTurnDuration(settings.animationSpeed);
    }
  }, [setTurnDuration, settings.animationSpeed, turnDuration]);

  useEffect(() => {
    if (gameMode === "private" && socketSnapshot.roomState?.status === "lobby" && stage !== "PRIVATE_LOBBY" && stage !== "HOME" && stage !== "MODE_SELECT") {
      setShowScramble(false);
      setOnlineMatch(null);
      setOnlineResult(null);
      onlineStartAtRef.current = null;
      onlineFinishSentRef.current = false;
      dispatch({ type: "SELECT_PRIVATE" });
    }
  }, [gameMode, socketSnapshot.roomState?.status, stage]);

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
      if (countdownIntervalRef.current !== null) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (countdownTimeoutRef.current !== null) {
        window.clearTimeout(countdownTimeoutRef.current);
        countdownTimeoutRef.current = null;
      }

      serverClockOffsetRef.current = Date.now() - payload.serverNow;
      dispatch({ type: "START_COUNTDOWN" });
      setCountdownValue("3");
      audioManager.playCountdownBeep();

      let lastPlayedValue = "3";
      const countdownEndAt = payload.countdownAt + payload.countdownMs;
      const updateCountdown = () => {
        const remainingMs = countdownEndAt - (Date.now() - serverClockOffsetRef.current);
        let newVal: string;
        if (remainingMs > 2_000) newVal = "3";
        else if (remainingMs > 1_000) newVal = "2";
        else if (remainingMs > 0) newVal = "1";
        else newVal = "GO";

        if (newVal !== lastPlayedValue) {
          lastPlayedValue = newVal;
          setCountdownValue(newVal);
          if (newVal === "GO") audioManager.playGo();
          else audioManager.playCountdownBeep(newVal === "1");
        }
      };

      updateCountdown();
      const interval = window.setInterval(updateCountdown, 100);
      countdownIntervalRef.current = interval;

      const timeout = window.setTimeout(() => {
        window.clearInterval(interval);
        if (countdownIntervalRef.current === interval) {
          countdownIntervalRef.current = null;
        }
      }, payload.countdownMs + 700);
      countdownTimeoutRef.current = timeout;
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
        const isSpec = socketSnapshot.roomState?.spectator?.clientId === socketSnapshot.clientId;

        if (isSpec && socketSnapshot.roomState) {
          if (payload.clientId === socketSnapshot.roomState.host.clientId) {
            useCubeStore.getState().enqueueMove(move);
          } else if (payload.clientId === socketSnapshot.roomState.guest?.clientId) {
            setOnlineOpponent((current) => current ? {
              ...current,
              status: "solving",
              moveCount: current.moveCount + 1,
            } : current);
            setOnlineOpponentCube((current) => current ? enqueueAnimatedMove(current, move) : current);
          }
        } else {
          setOnlineOpponent((current) => current ? {
            ...current,
            status: "solving",
            moveCount: current.moveCount + 1,
          } : current);
          setOnlineOpponentCube((current) => current ? enqueueAnimatedMove(current, move) : current);
        }
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
        ratingUpdates: payload.ratingUpdates,
      };

      if (gameMode === "private" && you && opponent) {
        try {
          const privateHistory = JSON.parse(localStorage.getItem("cuberanked.private_history") || "[]");
          const newRecord = {
            id: payload.matchId,
            opponent: opponent.username,
            timeMs: you.finalTimeMs,
            winner: payload.winnerClientId === socketSnapshot.clientId ? "You" : opponent.username,
            date: new Date().toISOString(),
            replayId: `replay-${payload.matchId.slice(0, 8)}`,
          };
          privateHistory.unshift(newRecord);
          localStorage.setItem("cuberanked.private_history", JSON.stringify(privateHistory.slice(0, 50)));
        } catch (err) {
          console.error("Error saving private match history:", err);
        }
      }

      if (you) {
        saveReplay({
          replayId: `replay-${payload.matchId}`,
          matchId: payload.matchId,
          gameMode: gameMode === "private" ? "private" : "ranked",
          scramble,
          startedAt: new Date().toISOString(),
          durationMs: you.finalTimeMs ?? 0,
          inspectionTimeMs: 0,
          penalty: you.status === "forfeit" ? "DNF" : "none",
          result: you.status === "finished" ? "SOLVED" : you.status === "forfeit" ? "QUIT" : "DNF",
          won: payload.winnerClientId === socketSnapshot.clientId,
          puzzle: "3x3",
          moves: [...replayMovesRef.current],
        });
        setLifetimeStats(calculateLifetimeStats(getLocalReplays()));
      }

      setOnlineResult(result);
      setRaceResult(resultToRaceResult(result));
      setElapsedMs(you?.finalTimeMs ?? elapsedMs);

      // Refresh profile to update Glicko stats in UI
      if (auth.mode === "authenticated") {
        void auth.refreshProfile();
      }

      // Check for promotion/demotion
      if (you && result.ratingUpdates) {
        const myUpdate = result.ratingUpdates.find(u => u.clientId === you.clientId);
        if (myUpdate && !myUpdate.isPlacement) {
          const prevRank = getRankFromRating(myUpdate.previousRating, false);
          const newRank = getRankFromRating(myUpdate.newRating, false);
          
          if (prevRank.tier !== newRank.tier && myUpdate.newRating > myUpdate.previousRating) {
            setPromotionData({ rank: newRank, isPromotion: true });
          } else if (prevRank.tier !== newRank.tier && myUpdate.newRating < myUpdate.previousRating) {
            setPromotionData({ rank: newRank, isPromotion: false });
          }
        }
      }

      dispatch({ type: "SOLVE_COMPLETE" });
    });

    return () => {
      if (countdownIntervalRef.current !== null) {
        window.clearInterval(countdownIntervalRef.current);
      }
      if (countdownTimeoutRef.current !== null) {
        window.clearTimeout(countdownTimeoutRef.current);
      }
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

  // Network recovery & cleanup effect
  const [reconnectCountdown, setReconnectCountdown] = useState<number | null>(null);
  const prevConnectionStateRef = useRef<SocketConnectionState>(socketSnapshot.connectionState);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const prev = prevConnectionStateRef.current;
    const current = socketSnapshot.connectionState;
    prevConnectionStateRef.current = current;

    if (prev !== "connected" && current === "connected") {
      if (stage === "MATCHMAKING") {
        socketManager.joinQueue();
        showNotice("Reconnected! Restoring queue state...", 2000);
      }
    }
  }, [socketSnapshot.connectionState, stage, showNotice]);

  useEffect(() => {
    const isMultiplayerActive = (gameMode === "ranked" || gameMode === "private") &&
      (stage === "COUNTDOWN" || stage === "READY" || stage === "INSPECTION" || stage === "PLAYING");

    if (isMultiplayerActive && socketSnapshot.connectionState !== "connected") {
      if (reconnectCountdown === null) {
        setReconnectCountdown(30);
        showNotice("Connection lost! Attempting to reconnect...", 2000);
      }
    } else {
      setReconnectCountdown(null);
    }
  }, [socketSnapshot.connectionState, stage, gameMode, reconnectCountdown, showNotice]);

  useEffect(() => {
    if (reconnectCountdown === null) return;
    if (reconnectCountdown <= 0) {
      showNotice("Connection recovery failed. Forfeiting match...", 3000);
      setReconnectCountdown(null);
      returnHome();
      return;
    }

    const timer = window.setInterval(() => {
      setReconnectCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [reconnectCountdown, showNotice]);

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
    if (stage !== "COUNTDOWN" || gameMode === "ranked" || gameMode === "private" || overlay !== "NONE") {
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
      window.setTimeout(() => { setCountdownValue("2"); audioManager.playCountdownBeep(); }, 850),
      window.setTimeout(() => { setCountdownValue("1"); audioManager.playCountdownBeep(true); }, 1_700),
      window.setTimeout(() => { setCountdownValue("GO"); audioManager.playGo(); }, 2_550),
      window.setTimeout(() => {
        const now = performance.now();
        solveStartRef.current = now;
        setElapsedMs(0);
        setBotOpponent((current) => current ? { ...current, status: "solving" } : current);
        // For bot race: COUNTDOWN_COMPLETE → READY, player starts on first move
        // The bot timer started here, player timer starts on first move
        dispatch({ type: "COUNTDOWN_COMPLETE" });
      }, 3_050),
    ];

    // Play first beep immediately
    audioManager.playCountdownBeep();

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [gameMode, overlay, stage]);

  useEffect(() => {
    if (stage === "READY" && effectiveInspectionEnabled && overlay === "NONE") {
      beginInspection();
    }
  }, [stage, effectiveInspectionEnabled, overlay, beginInspection]);

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

      const isSpectator = socketSnapshot.roomState?.spectator?.clientId === socketSnapshot.clientId;
      if (overlay !== "NONE" || stage === "MODE_SELECT" || stage === "MATCH_LOADING" || stage === "RESULT" || isSpectator) {
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

      const pressedKey = event.key.toUpperCase();
      const bindings = settings.keybindings || DEFAULT_SETTINGS.keybindings;
      const face = (Object.keys(bindings) as Face[]).find(
        (f) => bindings[f]?.toUpperCase() === pressedKey
      );

      if (face && MOVE_FACES.includes(face)) {
        event.preventDefault();
        playFace(face, event.shiftKey ? inverseTurnMode(turnMode) : turnMode);
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
      {/* First-run identity chooser screen */}
      <AnimatePresence mode="wait">
        {auth.isFirstVisit && auth.mode !== "loading" ? (
          <IdentityScreen
            key="identity"
            onGuest={() => {
              auth.continueAsGuest();
            }}
            onGoogle={() => {
              auth.dismissFirstVisit();
              void auth.startOAuth("google");
            }}
            onEmail={() => {
              auth.dismissFirstVisit();
              setAuthModal("login");
            }}
          />
        ) : null}
      </AnimatePresence>

      {(!auth.isFirstVisit || auth.mode === "loading") && (
        <AnimatePresence mode="wait">
          {stage === "HOME" || stage === "MODE_SELECT" ? (
            <HomeScreen
              key="home"
              connectionState={socketSnapshot.connectionState}
              onlineCount={socketSnapshot.onlineCount}
              authMode={auth.mode}
              user={auth.user}
              onSettings={() => dispatch({ type: "OPEN_APP_SETTINGS" })}
              onLogin={() => setAuthModal("login")}
              onRegister={() => setAuthModal("register")}
              onGuest={auth.continueAsGuest}
              onProfile={() => setAuthModal(auth.mode === "authenticated" ? "profile" : "login")}
              onLogout={() => void auth.logout().catch(handleAuthError)}
              onPractice={() => dispatch({ type: "SELECT_PRACTICE" })}
              onBotRace={() => dispatch({ type: "SELECT_BOT_RACE" })}
              onRanked={enterRankedQueue}
              onPrivate={() => dispatch({ type: "SELECT_PRIVATE" })}
              onLearn={() => dispatch({ type: "SELECT_LEARN" })}
              socketSnapshot={socketSnapshot}
            />
          ) : stage === "LEARN" ? (
            <LearnMode
              key="learn"
              onBack={returnHome}
              theme={settings.theme}
              cameraSensitivity={settings.cameraSensitivity}
              cameraZoomSpeed={settings.cameraZoomSpeed}
              cameraInvertVertical={settings.cameraInvertVertical}
            />
          ) : stage === "MATCHMAKING" ? (
            <QueueScreen
              key="queue"
              queue={queueUpdate}
              connectionState={socketSnapshot.connectionState}
              onCancel={cancelRankedQueue}
            />
          ) : stage === "PRIVATE_LOBBY" ? (
            <PrivateLobbyScreen
              key="private-lobby"
              roomState={socketSnapshot.roomState}
              roomError={socketSnapshot.roomError}
              clientId={socketSnapshot.clientId}
              onBack={returnHome}
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
              effectiveInspectionEnabled={effectiveInspectionEnabled}
            />
          )}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {stage === "MODE_SELECT" ? (
          <PlayModal
            onClose={() => dispatch({ type: "CLOSE_MODE_SELECT" })}
            onPractice={() => dispatch({ type: "SELECT_PRACTICE" })}
            onBotRace={() => dispatch({ type: "SELECT_BOT_RACE" })}
            onRanked={enterRankedQueue}
            onPrivate={() => dispatch({ type: "SELECT_PRIVATE" })}
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
            allowReset={!(gameMode === "ranked" || gameMode === "private") || (stage !== "PLAYING" && stage !== "SOLVED")}
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
            onOpenRebinds={() => {
              dispatch({ type: "CLOSE_OVERLAY" });
              setSettingsCategory("Controls");
              dispatch({ type: "OPEN_APP_SETTINGS" });
            }}
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
        {stage === "RESULT" && !promotionData ? (
          <ResultsModal
            solve={lastSolve}
            raceResult={raceResult}
            onlineResult={onlineResult}
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
        {promotionData ? (
          <RankPromotionAnimation
            rank={promotionData.rank}
            isPromotion={promotionData.isPromotion}
            onComplete={() => setPromotionData(null)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {authModal === "login" || authModal === "register" ? (
          <AuthDialog
            mode={authModal}
            error={auth.error}
            onClose={() => {
              auth.clearError();
              setAuthModal("none");
            }}
            onMode={setAuthModal}
            onGuest={() => {
              auth.continueAsGuest();
              setAuthModal("none");
            }}
            onLogin={async (input) => {
              try {
                await auth.login(input);
                setAuthModal("none");
              } catch (error) {
                handleAuthError(error);
              }
            }}
            onRegister={async (input) => {
              try {
                await auth.register(input);
                setAuthModal("none");
              } catch (error) {
                handleAuthError(error);
              }
            }}
            onOAuth={(provider) => void auth.startOAuth(provider).catch(handleAuthError)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {authModal === "profile" && (auth.user || auth.mode === "guest") ? (
          <ProfileDialog
            user={auth.user ?? guestProfile}
            onClose={() => setAuthModal("none")}
            onSave={async (patch) => {
              if (auth.mode === "guest") return; // guests cannot save profile changes to cloud
              if (patch.theme) {
                updateSettings({ theme: patch.theme });
              }
              await auth.updateProfile(patch);
            }}
            onLogout={() => {
              if (auth.mode === "authenticated") {
                void auth.logout().catch(handleAuthError);
              }
              setAuthModal("none");
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {rankedGateOpen ? (
          <RankedGateModal
            onClose={() => setRankedGateOpen(false)}
            onGoogle={() => {
              setRankedGateOpen(false);
              void auth.startOAuth("google");
            }}
            onEmail={() => {
              setRankedGateOpen(false);
              setAuthModal("login");
            }}
            onRegister={() => {
              setRankedGateOpen(false);
              setAuthModal("register");
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {socketSnapshot.incomingInvite ? (
          <div className="ranked-gate-overlay" style={{ zIndex: 9200 }}>
            <div className="ranked-gate-modal" style={{ maxWidth: "380px" }}>
              <div className="ranked-gate-header">
                <div className="ranked-gate-trophy" style={{ background: "rgba(99,102,241,0.15)", borderColor: "rgba(99,102,241,0.25)", color: "#818cf8" }}>
                  <Users size={24} />
                </div>
                <div>
                  <h2>Lobby Invite</h2>
                  <p style={{ marginTop: "4px" }}>
                    <strong>{socketSnapshot.incomingInvite.inviterName}</strong> has invited you to{" "}
                    {socketSnapshot.incomingInvite.type === "private-room" ? "race in a Private Room" : "spectate their match"}!
                  </p>
                </div>
              </div>

              <div className="ranked-gate-actions" style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button
                  type="button"
                  className="ranked-gate-btn google"
                  onClick={() => {
                    const code = socketSnapshot.incomingInvite.roomCode;
                    const type = socketSnapshot.incomingInvite.type;
                    socketManager.clearIncomingInvite();
                    if (code) {
                      if (type === "private-room") {
                        socketManager.joinRoom(code);
                      } else {
                        socketManager.spectateRoom(code);
                      }
                      dispatch({ type: "SELECT_PRIVATE" });
                    }
                  }}
                >
                  Accept Invite
                </button>
                <button
                  type="button"
                  className="ranked-gate-btn email"
                  onClick={() => {
                    socketManager.clearIncomingInvite();
                  }}
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
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

      {reconnectCountdown !== null && (
        <div className="reconnect-overlay-new" style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(3, 3, 5, 0.9)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
        }}>
          <div className="reconnect-dialog-new" style={{
            background: "#09090b",
            border: "1px solid #1e1b4b",
            borderRadius: "16px",
            padding: "32px",
            textAlign: "center",
            maxWidth: "400px",
            width: "90%",
            boxShadow: "0 0 40px rgba(99, 102, 241, 0.15)",
          }}>
            <Loader2 className="loading-spinner animate-spin" size={36} style={{ color: "#818cf8", margin: "0 auto 16px auto" }} />
            <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#f4f4f5", marginBottom: "8px" }}>Connection Interrupted</h3>
            <p style={{ fontSize: "14px", color: "#a1a1aa", marginBottom: "20px" }}>
              Attempting to restore connection to match...
            </p>
            <div style={{
              background: "#18181b",
              borderRadius: "8px",
              padding: "12px",
              fontSize: "15px",
              fontWeight: 700,
              color: "#818cf8",
            }}>
              Reconnect Window: {reconnectCountdown}s
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function HomeScreen({
  connectionState,
  onlineCount,
  authMode,
  user,
  onSettings,
  onLogin,
  onRegister,
  onGuest,
  onProfile,
  onLogout,
  onPractice,
  onBotRace,
  onRanked,
  onPrivate,
  onLearn,
  socketSnapshot,
}: {
  connectionState: SocketConnectionState;
  onlineCount: number;
  authMode: "loading" | "guest" | "authenticated";
  user: UserProfile | null;
  onSettings: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onGuest: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onPractice: () => void;
  onBotRace: () => void;
  onRanked: () => void;
  onPrivate: () => void;
  onLearn: () => void;
  socketSnapshot: SocketDebugSnapshot;
}) {
  const [socialOpen, setSocialOpen] = useState(false);
  return (
    <motion.section
      className="home-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <AppBackground />
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
        <motion.div
          className="brand-orbit"
          animate={{ rotate: 360 }}
          transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <header className="home-topbar-new">
        <div className="launcher-brand-new">
          <img src="/logos/CubeRankedLogosFull.png" alt="CubeRanked" style={{ height: "42px", width: "auto", objectFit: "contain" }} />
        </div>

        <div className="top-right-actions">
          <div className={`connection-pill connection-${connectionState}`}>
            <span />
            {connectionLabel(connectionState)}
          </div>
          <div className="online-count-badge">
            <span className="pulse-dot" />
            {onlineCount.toLocaleString()} Online
          </div>

          {authMode !== "loading" && (
            <button
              type="button"
              className="social-toggle-btn"
              onClick={() => setSocialOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 14px",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(148, 163, 184, 0.16)",
                color: "#e2e8f0",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 150ms ease",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
                e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.16)";
              }}
            >
              <Users size={15} />
              <span>Social</span>
              {socketSnapshot.friendRequests.length > 0 && (
                <span style={{
                  display: "grid",
                  placeItems: "center",
                  minWidth: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  padding: "0 4px",
                }}>
                  {socketSnapshot.friendRequests.length}
                </span>
              )}
            </button>
          )}
          
          {authMode === "authenticated" && user ? (
            <div className="user-profile-widget">
              <button type="button" className="profile-chip-btn" onClick={onProfile}>
                {user.avatar ? (
                  <img src={user.avatar} alt="" />
                ) : (
                  <span>{user.username.slice(0, 2).toUpperCase()}</span>
                )}
                <strong>{user.username}</strong>
              </button>
              <button type="button" className="logout-icon-btn" onClick={onLogout} title="Logout">
                <LogOut size={16} />
              </button>
            </div>
          ) : authMode === "guest" ? (
            <div className="user-profile-widget">
              <button type="button" className="profile-chip-btn" onClick={onLogin}>
                <span>G</span>
                <strong>Guest Player</strong>
              </button>
              <button type="button" className="auth-action-btn" onClick={onLogin}>
                Sign In
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <button type="button" className="auth-btn login" onClick={onLogin}>
                <LogIn size={14} /> Log In
              </button>
              <button type="button" className="auth-btn register" onClick={onRegister}>
                <UserPlus size={14} /> Register
              </button>
              <button type="button" className="auth-btn guest" onClick={onGuest}>
                <User size={14} /> Guest
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="lobby-modes-container">
        <div className="lobby-modes-header">
          <span>Select Game Mode</span>
          <h1>LOBBY</h1>
        </div>
        
        <div className="lobby-modes-grid">
          <button type="button" className="lobby-mode-card" onClick={onPractice}>
            <div className="mode-card-icon-wrap icon-practice">
              <Gamepad2 size={28} />
            </div>
            <div className="mode-card-info">
              <h3>Practice</h3>
              <p>Offline 3x3 trainer & scramble stats</p>
            </div>
            <div className="mode-card-status select-text">
              Enter Mode
            </div>
          </button>

          <button type="button" className="lobby-mode-card" onClick={onBotRace}>
            <div className="mode-card-icon-wrap icon-bot">
              <Tv size={28} />
            </div>
            <div className="mode-card-info">
              <h3>Bot Race</h3>
              <p>Race a human-like AI speedcuber</p>
            </div>
            <div className="mode-card-status select-text">
              Enter Mode
            </div>
          </button>

          <button type="button" className="lobby-mode-card" onClick={onRanked}>
            <div className="mode-card-icon-wrap icon-ranked">
              <Trophy size={28} />
            </div>
            <div className="mode-card-info">
              <h3>Ranked</h3>
              <p>Matchmake against live opponents online</p>
            </div>
            <div className="mode-card-status select-text">
              Find Match
            </div>
          </button>

          <button type="button" className="lobby-mode-card" onClick={onPrivate}>
            <div className="mode-card-icon-wrap icon-private">
              <Users size={28} />
            </div>
            <div className="mode-card-info">
              <h3>Private Room</h3>
              <p>Create or join custom multiplayer lobby</p>
            </div>
            <div className="mode-card-status select-text">
              Join Room
            </div>
          </button>

          <button type="button" className="lobby-mode-card learn-featured-card" onClick={onLearn} style={{ gridColumn: "span 2" }}>
            <div className="mode-card-icon-wrap icon-learn">
              <GraduationCap size={28} />
            </div>
            <div className="mode-card-info">
              <div className="featured-badge">Academy</div>
              <h3>Learn</h3>
              <p>Master Rubik's Cube notation and interactive beginner-to-advanced lessons</p>
            </div>
            <div className="mode-card-status select-text">
              Enter Academy
            </div>
          </button>
        </div>
      </div>

      <footer className="home-footer-new">
        <div className="footer-left">
          <span>Client Version {VERSION}</span>
        </div>
        <div className="footer-right">
          <button type="button" className="footer-settings-btn" onClick={onSettings}>
            <Settings size={16} />
            Settings
          </button>
        </div>
      </footer>

      <AnimatePresence>
        {socialOpen && (
          <SocialSidebar
            snapshot={socketSnapshot}
            onClose={() => setSocialOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function LoadingScreen({
  mode,
  opponent,
}: {
  mode: GameMode;
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
      <AppBackground />
      <motion.div
        className="loading-card"
        initial={{ y: 18, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -12, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 160, damping: 22 }}
      >
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
      <AppBackground />
      <motion.div
        className="queue-card"
        initial={{ y: 18, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -12, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 160, damping: 22 }}
      >
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
  onPrivate,
  onLockedMode,
}: {
  onClose: () => void;
  onPractice: () => void;
  onBotRace: () => void;
  onRanked: () => void;
  onPrivate: () => void;
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
                      : mode.mode === "private"
                        ? onPrivate
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

interface PrivateLobbyScreenProps {
  roomState: RoomState | null;
  roomError: string | null;
  clientId: string | null;
  onBack: () => void;
}

function PrivateLobbyScreen({ roomState, roomError, clientId, onBack }: PrivateLobbyScreenProps) {
  const [joinCode, setJoinCode] = useState("");
  const [chatText, setChatText] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [roomState?.chat]);

  const handleCreate = () => {
    socketManager.createRoom();
  };

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    if (joinCode.trim().length === 6) {
      socketManager.joinRoom(joinCode.trim().toUpperCase());
    }
  };

  const handleSpectate = (e: FormEvent) => {
    e.preventDefault();
    if (joinCode.trim().length === 6) {
      socketManager.spectateRoom(joinCode.trim().toUpperCase());
    }
  };

  const handleSendChat = (e: FormEvent) => {
    e.preventDefault();
    if (chatText.trim()) {
      socketManager.sendRoomChat(chatText.trim());
      setChatText("");
    }
  };

  const handleSettingsChange = (update: Partial<RoomSettings>) => {
    socketManager.updateRoomSettings(update);
  };

  const handleCopyCode = () => {
    if (!roomState) return;
    navigator.clipboard.writeText(roomState.code).catch(() => undefined);
  };

  const handleCopyLink = () => {
    if (!roomState) return;
    const link = `${window.location.origin}${window.location.pathname}?room=${roomState.code}`;
    navigator.clipboard.writeText(link).catch(() => undefined);
  };

  const isHost = roomState?.host.clientId === clientId;
  const isGuest = roomState?.guest?.clientId === clientId;
  const isSpectator = roomState?.spectator?.clientId === clientId;

  const canStart = roomState && roomState.host.ready && roomState.guest?.ready && roomState.host.connected && roomState.guest.connected;

  if (!roomState) {
    return (
      <motion.section
        className="private-setup-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <AppBackground />

        <div className="setup-container">
          <header className="setup-header">
            <button type="button" className="back-btn" onClick={onBack}>
              <ChevronLeft size={16} />
              Back
            </button>
            <h2>Private Multiplayer</h2>
          </header>

          <div className="setup-card">
            <h3>Create a Room</h3>
            <p>Start a new private match lobby and invite your friends to race.</p>
            <button type="button" className="create-room-btn" onClick={handleCreate}>
              <Play size={16} />
              Create Room
            </button>

            <div className="divider"><span>OR</span></div>

            <h3>Join Room</h3>
            <form onSubmit={handleJoin} className="join-form">
              <input
                type="text"
                placeholder="Enter 6-char code (e.g. A7K9XM)"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="code-input"
              />
              <div className="join-actions">
                <button type="submit" disabled={joinCode.trim().length !== 6} className="join-btn">
                  Join as Player
                </button>
                <button type="button" onClick={handleSpectate} disabled={joinCode.trim().length !== 6} className="spectate-btn">
                  <Tv size={16} />
                  Spectate
                </button>
              </div>
            </form>

            {roomError && (
              <div className="room-error-alert">
                {roomError}
              </div>
            )}
          </div>
        </div>
      </motion.section>
    );
  }

  const hostWins = roomState.scores[roomState.host.clientId] || 0;
  const guestWins = roomState.guest ? (roomState.scores[roomState.guest.clientId] || 0) : 0;

  return (
    <motion.section
      className="private-lobby-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <AppBackground />

      <div className="lobby-container">
        <header className="lobby-header">
          <button type="button" className="back-btn" onClick={() => socketManager.leaveRoom()}>
            <ChevronLeft size={16} />
            Leave Room
          </button>
          <div className="lobby-title">
            <span>Room Code</span>
            <h2>{roomState.code}</h2>
          </div>
          <div className="invite-actions">
            <button type="button" onClick={handleCopyCode} className="action-chip">
              <Copy size={14} />
              Copy Code
            </button>
            <button type="button" onClick={handleCopyLink} className="action-chip">
              <Share2 size={14} />
              Copy Link
            </button>
          </div>
        </header>

        <div className="lobby-grid">
          <div className="lobby-players-panel">
            <h3>Lobby Players</h3>
            <div className="players-list">
              <div className={`lobby-player-card ${roomState.host.connected ? "online" : "offline"}`}>
                <div className="player-avatar">
                  {roomState.host.avatar ? (
                    <img src={roomState.host.avatar} alt="" />
                  ) : (
                    roomState.host.username.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="player-info">
                  <div className="name-row">
                    <strong>{roomState.host.username}</strong>
                    <span className="role-tag">Host</span>
                  </div>
                  <span className="ping-text">{roomState.host.connected ? `Ping: ${roomState.host.pingMs ?? "--"}ms` : "Disconnected"}</span>
                </div>
                <div className={`ready-badge ${roomState.host.ready ? "ready" : "not-ready"}`}>
                  {roomState.host.ready ? "READY" : "NOT READY"}
                </div>
              </div>

              {roomState.guest ? (
                <div className={`lobby-player-card ${roomState.guest.connected ? "online" : "offline"}`}>
                  <div className="player-avatar">
                    {roomState.guest.avatar ? (
                      <img src={roomState.guest.avatar} alt="" />
                    ) : (
                      roomState.guest.username.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="player-info">
                    <div className="name-row">
                      <strong>{roomState.guest.username}</strong>
                      <span className="role-tag">Guest</span>
                    </div>
                    <span className="ping-text">{roomState.guest.connected ? `Ping: ${roomState.guest.pingMs ?? "--"}ms` : "Disconnected"}</span>
                  </div>
                  <div className={`ready-badge ${roomState.guest.ready ? "ready" : "not-ready"}`}>
                    {roomState.guest.ready ? "READY" : "NOT READY"}
                  </div>
                </div>
              ) : (
                <div className="lobby-player-card empty">
                  <Users size={20} />
                  <span>Waiting for guest...</span>
                </div>
              )}

              {roomState.spectator ? (
                <div className="lobby-player-card spectator">
                  <div className="player-avatar">
                    {roomState.spectator.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="player-info">
                    <div className="name-row">
                      <strong>{roomState.spectator.username}</strong>
                      <span className="role-tag spec">Spectator</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="lobby-score-board">
              <h4>Series Score</h4>
              <div className="scores-row">
                <div className="score-block">
                  <span className="player-label">Host</span>
                  <span className="score-num">{hostWins}</span>
                </div>
                <div className="score-divider">:</div>
                <div className="score-block">
                  <span className="player-label">Guest</span>
                  <span className="score-num">{guestWins}</span>
                </div>
              </div>
              <div className="best-of-target">
                First to {Math.ceil(roomState.settings.bestOf / 2)} wins (Best of {roomState.settings.bestOf})
              </div>
            </div>
          </div>

          <div className="lobby-details-panel">
            <div className="lobby-settings-card">
              <h3>Match Settings</h3>
              <div className="settings-grid">
                <label className="select-row">
                  <span>Puzzle</span>
                  <select disabled value="3x3">
                    <option value="3x3">3x3</option>
                  </select>
                </label>
                <label className="select-row">
                  <span>Game Type</span>
                  <select disabled value="race">
                    <option value="race">Race</option>
                  </select>
                </label>
                <label className="switch-row compact">
                  <span>Inspection (15s)</span>
                  <input
                    type="checkbox"
                    checked={roomState.settings.inspectionEnabled}
                    disabled={!isHost}
                    onChange={(e) => handleSettingsChange({ inspectionEnabled: e.target.checked })}
                  />
                </label>
                <label className="select-row">
                  <span>Series Length</span>
                  <select
                    value={roomState.settings.bestOf}
                    disabled={!isHost}
                    onChange={(e) => handleSettingsChange({ bestOf: Number(e.target.value) as 1 | 3 | 5 })}
                  >
                    <option value={1}>Best of 1 (Single)</option>
                    <option value={3}>Best of 3</option>
                    <option value={5}>Best of 5</option>
                  </select>
                </label>
                <label className="select-row">
                  <span>Scramble Visibility</span>
                  <select
                    value={roomState.settings.scrambleVisibility}
                    disabled={!isHost}
                    onChange={(e) => handleSettingsChange({ scrambleVisibility: e.target.value as "hidden" | "visible" })}
                  >
                    <option value="hidden">Hidden during race</option>
                    <option value="visible">Visible (Practice Mode)</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="lobby-chat-card">
              <h3>Lobby Chat</h3>
              <div className="chat-messages-box">
                {roomState.chat.map((msg: ChatMessage) => {
                  const isSys = msg.senderName === "System";
                  return (
                    <div key={msg.id} className={`chat-line ${isSys ? "system" : ""}`}>
                      {!isSys && <span className="chat-sender">{msg.senderName}:</span>}
                      <span className="chat-text">{msg.text}</span>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendChat} className="chat-input-form">
                <input
                  type="text"
                  placeholder="Type a message..."
                  maxLength={140}
                  value={chatText}
                  disabled={isSpectator}
                  onChange={(e) => setChatText(e.target.value)}
                />
                <button type="submit" disabled={!chatText.trim() || isSpectator}>
                  <Send size={14} />
                </button>
              </form>
            </div>
          </div>
        </div>

        <footer className="lobby-footer">
          {roomState.status === "finished" ? (
            <div className="series-finished-banner">
              <h3>
                🏆 Series Won by{" "}
                {roomState.winnerClientId === roomState.host.clientId
                  ? roomState.host.username
                  : roomState.guest?.username}
                !
              </h3>
              {isHost && (
                <button type="button" className="reset-series-btn" onClick={() => socketManager.resetRoomSeries()}>
                  Reset Series
                </button>
              )}
            </div>
          ) : (
            <div className="action-row">
              {isSpectator ? (
                <div className="spec-wait-msg">
                  Watching match... Waiting for host to start.
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className={`ready-toggle-btn ${
                      (isHost ? roomState.host.ready : roomState.guest?.ready) ? "is-ready" : ""
                    }`}
                    onClick={() => socketManager.toggleRoomReady()}
                  >
                    {(isHost ? roomState.host.ready : roomState.guest?.ready) ? "Cancel Ready" : "Press Ready"}
                  </button>

                  {isHost && (
                    <button
                      type="button"
                      className="start-match-btn"
                      disabled={!canStart}
                      onClick={() => socketManager.startRoomMatch()}
                    >
                      Start Match
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </footer>
      </div>
    </motion.section>
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
  effectiveInspectionEnabled,
}: {
  stage: PlayableStage;
  mode: GameMode;
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
  effectiveInspectionEnabled: boolean;
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
      <CubeScene 
        theme={settings.theme}
        cameraMode={settings.cameraMode}
        cameraInvertVertical={settings.cameraInvertVertical}
        cameraSensitivity={settings.cameraSensitivity}
        cameraZoomSpeed={settings.cameraZoomSpeed}
      />

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
            {mode === "private"
              ? (socketManager.getSnapshot().roomState?.spectator?.clientId === socketManager.getSnapshot().clientId ? "Spectating" : "Private Match")
              : isRankedMode ? "Ranked" : isBotRaceMode ? "Bot Race" : "Practice"}
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

        {settings.showKeyboardCheatSheet && (mode === "practice" || mode === "ranked" || mode === "bot-race" || mode === "private") ? (
          <KeyboardCheatSheet settings={settings} />
        ) : null}
      </div>

      <AnimatePresence>
        {stage === "COUNTDOWN" ? (
          <CountdownOverlay value={countdownValue} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {stage === "READY" ? (
          <ReadyOverlay
            inspectionEnabled={effectiveInspectionEnabled}
            isSpectator={mode === "private" && socketManager.getSnapshot().roomState?.spectator?.clientId === socketManager.getSnapshot().clientId}
          />
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
  const isGo = value === "GO";
  const isRed = value === "3";
  const isOrange = value === "2";
  const isGreen = value === "1" || isGo;

  return (
    <motion.div
      className="countdown-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, backgroundColor: isGo ? "rgba(0,0,0,0)" : "rgba(0,0,0,0.55)" }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.35 }}
    >
      {/* Radial glow behind everything */}
      <motion.div
        className="countdown-radial-glow"
        animate={{
          opacity: isGo ? 0.3 : 0.7,
          background: isRed
            ? "radial-gradient(circle at 50% 50%, rgba(239,68,68,0.4), transparent 60%)"
            : isOrange
            ? "radial-gradient(circle at 50% 50%, rgba(245,158,11,0.4), transparent 60%)"
            : "radial-gradient(circle at 50% 50%, rgba(16,185,129,0.4), transparent 60%)"
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Traffic light housing */}
      <div className="traffic-light-housing">
        <div className={`traffic-light-bulb red ${isRed ? "active" : ""}`} />
        <div className={`traffic-light-bulb orange ${isOrange ? "active" : ""}`} />
        <div className={`traffic-light-bulb green ${isGreen ? "active" : ""}`} />
      </div>

      {/* Big number / GO */}
      <AnimatePresence mode="wait">
        <motion.div
          key={value}
          className={`countdown-digit ${isGo ? "is-go" : value === "3" ? "is-red" : value === "2" ? "is-orange" : "is-green"}`}
          initial={{ scale: 0.5, opacity: 0, y: 32, filter: "blur(8px)" }}
          animate={{ scale: 1, opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ scale: 1.3, opacity: 0, y: -24, filter: "blur(6px)" }}
          transition={{ type: "spring", stiffness: 280, damping: 20 }}
        >
          {value}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

function ReadyOverlay({ inspectionEnabled, isSpectator }: { inspectionEnabled: boolean; isSpectator?: boolean }) {
  const message = isSpectator
    ? "Waiting for match to start..."
    : inspectionEnabled
    ? "Inspection starting..."
    : "Press any move key to start";

  return (
    <motion.div
      className="ready-overlay"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.24 }}
    >
      <span>READY</span>
      <strong>{message}</strong>
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
  onlineResult,
  isPersonalBest,
  mode,
  onPracticeAgain,
  onNewScramble,
  onHome,
  onReplay,
}: {
  solve: SolveRecord | null;
  raceResult: RaceResult | null;
  onlineResult?: OnlineRaceResult | null;
  isPersonalBest: boolean;
  mode: GameMode;
  onPracticeAgain: () => void;
  onNewScramble: () => void;
  onHome: () => void;
  onReplay: () => void;
}) {
  const isRace = (mode === "bot-race" || mode === "ranked" || mode === "private") && raceResult;
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

        {isRankedRace && onlineResult?.ratingUpdates ? (
          <div className="rating-updates-container">
            {onlineResult.ratingUpdates.filter(u => u.clientId === onlineResult.you?.clientId).map(update => {
              const diff = update.newRating - update.previousRating;
              const rank = getRankFromRating(update.newRating, update.isPlacement);
              return (
                <div key={update.clientId} className="rating-update-card">
                  <div className="rank-badge" style={{ borderColor: rank.color, color: rank.color }}>
                    {rank.badge}
                  </div>
                  <div className="rating-details">
                    <span className="tier-name" style={{ color: rank.color }}>{rank.tier}</span>
                    <div className="rating-numbers">
                      <span className="current-rating">{update.isPlacement ? "Unranked" : update.newRating}</span>
                      {!update.isPlacement && diff !== 0 && (
                        <span className={diff > 0 ? "rating-diff positive" : "rating-diff negative"}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      )}
                    </div>
                    {update.isPlacement && (
                      <div className="placement-progress">Placement: {update.placementMatchesPlayed}/5</div>
                    )}
                  </div>
                </div>
              );
            })}
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
            {mode === "private" ? (
              <>
                <Gamepad2 size={16} aria-hidden="true" />
                Exit to Lobby
              </>
            ) : (
              <>
                <HomeIcon size={16} aria-hidden="true" />
                Back to Home
              </>
            )}
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
  mode: GameMode;
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
            Reset Cube
          </button>
          <button type="button" onClick={onSettings}>
            <Settings size={16} aria-hidden="true" />
            Settings
          </button>
          <button type="button" onClick={onHome}>
            {mode === "private" ? (
              <>
                <Gamepad2 size={16} aria-hidden="true" />
                Exit to Lobby
              </>
            ) : (
              <>
                <HomeIcon size={16} aria-hidden="true" />
                Return Home
              </>
            )}
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
  allowReset,
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
  onOpenRebinds,
}: {
  mode: GameMode;
  settings: SessionSettings;
  scramble: string[];
  showScramble: boolean;
  copyLabel: string;
  turnMode: TurnMode;
  allowReset: boolean;
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
  onOpenRebinds: () => void;
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
        <button 
          type="button" 
          className="danger-button compact" 
          onClick={onReset}
          disabled={!allowReset}
        >
          <RotateCcw size={16} aria-hidden="true" />
          Reset Cube
        </button>
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

      <div className="keyboard-rebinds-popover-row">
        <button
          type="button"
          className="rebinds-redirect-btn"
          onClick={onOpenRebinds}
        >
          <Keyboard size={15} />
          <span>Configure Keybindings</span>
        </button>
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
  const categories: SettingsCategory[] = ["General", "Appearance", "Camera", "Controls", "Cube", "Graphics", "Audio", "Accessibility"];
  const [listeningFace, setListeningFace] = useState<Face | null>(null);

  useEffect(() => {
    if (!listeningFace) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setListeningFace(null);
        return;
      }

      const key = event.key.toUpperCase();
      const currentBindings = settings.keybindings || DEFAULT_SETTINGS.keybindings;
      const updatedBindings = {
        ...currentBindings,
        [listeningFace]: key,
      };

      onSettings({ keybindings: updatedBindings });
      setListeningFace(null);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [listeningFace, onSettings, settings.keybindings]);

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
              <div className="theme-toggle-container">
                <button
                  className={`premium-theme-toggle ${settings.theme === "dark" ? "is-dark" : "is-light"}`}
                  onClick={() => onSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
                  aria-label="Toggle theme"
                >
                  <motion.div
                    className="theme-toggle-orb"
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    {settings.theme === "dark" ? (
                      <Moon size={14} className="theme-icon-dark" />
                    ) : (
                      <Sun size={14} className="theme-icon-light" />
                    )}
                  </motion.div>
                  <div className="theme-toggle-bg" />
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
                <div className="keyboard-rebinds-section">
                  <div className="section-title">
                    <Keyboard size={16} />
                    <h4>Keyboard Rebinds</h4>
                  </div>
                  <div className="rebinds-grid">
                    {(["U", "R", "F", "D", "L", "B"] as Face[]).map((face) => {
                      const label = {
                        U: "Up (U)",
                        R: "Right (R)",
                        F: "Front (F)",
                        D: "Down (D)",
                        L: "Left (L)",
                        B: "Back (B)",
                      }[face];
                      const boundKey = (settings.keybindings || DEFAULT_SETTINGS.keybindings)[face];
                      const isListening = listeningFace === face;

                      return (
                        <div key={face} className="rebind-row">
                          <span>{label}</span>
                          <button
                            type="button"
                            className={`rebind-key-btn ${isListening ? "listening" : ""}`}
                            onClick={() => setListeningFace(face)}
                          >
                            {isListening ? "Press key..." : boundKey}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {listeningFace && (
                    <div className="rebind-tip">
                      Press any key to bind, or ESC to cancel
                    </div>
                  )}
                </div>
              </>
            ) : category === "Camera" ? (
              <div className="camera-settings-section" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>Camera Mode</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <button
                      type="button"
                      className={`mode-tab-btn ${settings.cameraMode === "competitive" ? "selected" : ""}`}
                      onClick={() => onSettings({ cameraMode: "competitive" })}
                      style={{
                        padding: "10px",
                        borderRadius: "8px",
                        background: settings.cameraMode === "competitive" ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.03)",
                        border: settings.cameraMode === "competitive" ? "1px solid #6366f1" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: settings.cameraMode === "competitive" ? "#e0e7ff" : "#94a3b8",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        transition: "all 150ms ease"
                      }}
                    >
                      Competitive
                    </button>
                    <button
                      type="button"
                      className={`mode-tab-btn ${settings.cameraMode === "free-orbit" ? "selected" : ""}`}
                      onClick={() => onSettings({ cameraMode: "free-orbit" })}
                      style={{
                        padding: "10px",
                        borderRadius: "8px",
                        background: settings.cameraMode === "free-orbit" ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.03)",
                        border: settings.cameraMode === "free-orbit" ? "1px solid #6366f1" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: settings.cameraMode === "free-orbit" ? "#e0e7ff" : "#94a3b8",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        transition: "all 150ms ease"
                      }}
                    >
                      Free Orbit
                    </button>
                  </div>
                  <small style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "4px" }}>
                    {settings.cameraMode === "competitive" 
                      ? "Competitive Mode uses a fixed, optimized view angle for standard plays." 
                      : "Free Orbit Mode allows unrestricted rotation and zoom to inspect the cube from any angle."}
                  </small>
                </div>

                <label className="switch-row compact">
                  <span>Invert Vertical Rotation</span>
                  <input
                    type="checkbox"
                    checked={settings.cameraInvertVertical}
                    onChange={(event) => onSettings({ cameraInvertVertical: event.target.checked })}
                  />
                </label>

                <label className="range-row compact">
                  <span>Mouse Sensitivity ({settings.cameraSensitivity.toFixed(1)}x)</span>
                  <input
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.1"
                    value={settings.cameraSensitivity}
                    onChange={(event) => onSettings({ cameraSensitivity: Number(event.target.value) })}
                  />
                </label>

                <label className="range-row compact">
                  <span>Zoom Speed ({settings.cameraZoomSpeed.toFixed(1)}x)</span>
                  <input
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.1"
                    value={settings.cameraZoomSpeed}
                    onChange={(event) => onSettings({ cameraZoomSpeed: Number(event.target.value) })}
                  />
                </label>
              </div>
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





function AuthDialog({
  mode,
  error,
  onClose,
  onMode,
  onGuest,
  onLogin,
  onRegister,
  onOAuth,
}: {
  mode: "login" | "register";
  error: string | null;
  onClose: () => void;
  onMode: (mode: AuthModal) => void;
  onGuest: () => void;
  onLogin: (input: { email: string; password: string; rememberMe: boolean }) => Promise<void>;
  onRegister: (input: { username: string; email: string; password: string; rememberMe: boolean }) => Promise<void>;
  onOAuth: (provider: "google" | "github" | "discord") => void;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    try {
      if (isRegister) {
        await onRegister({ username, email, password, rememberMe });
      } else {
        await onLogin({ email, password, rememberMe });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.form
        className="auth-dialog"
        onSubmit={submit}
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 170, damping: 20 }}
      >
        <div className="modal-head">
          <div>
            <span>Account</span>
            <h2>{isRegister ? "Create Account" : "Login"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close account dialog">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="auth-fields">
          {isRegister ? (
            <label>
              <span>Username</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required minLength={3} />
            </label>
          ) : null}
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isRegister ? "new-password" : "current-password"} required minLength={isRegister ? 8 : 1} />
          </label>
          <label className="switch-row compact">
            <span>Remember Me</span>
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
          </label>
        </div>

        {error ? <div className="auth-error">{error}</div> : null}

        <button type="submit" className="auth-submit" disabled={busy}>
          {isRegister ? <UserPlus size={16} aria-hidden="true" /> : <LogIn size={16} aria-hidden="true" />}
          {busy ? "Working..." : isRegister ? "Register" : "Login"}
        </button>

        <div className="oauth-row">
          <button type="button" onClick={() => onOAuth("google")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            Google
          </button>
        </div>

        <div className="auth-switch">
          <button type="button" onClick={() => onMode(isRegister ? "login" : "register")}>
            {isRegister ? "Already have an account?" : "Need an account?"}
          </button>
          <button type="button" onClick={onGuest}>Continue as Guest</button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function ProfileDialog({
  user,
  onClose,
  onSave,
  onLogout,
}: {
  user: UserProfile;
  onClose: () => void;
  onSave: (patch: Partial<Pick<UserProfile, "username" | "avatar" | "country" | "bio" | "theme" | "favoriteMode">>) => Promise<void>;
  onLogout: () => void;
}) {
  const isGuest = user.id === "guest";
  const auth = useAuth();
  const [draft, setDraft] = useState({
    username: user.username,
    avatar: user.avatar ?? "",
    country: user.country ?? "",
    bio: user.bio,
    theme: user.theme,
    favoriteMode: user.favoriteMode,
  });
  const [privateHistory, setPrivateHistory] = useState<any[]>([]);

  useEffect(() => {
    try {
      const hist = JSON.parse(localStorage.getItem("cuberanked.private_history") || "[]");
      setPrivateHistory(hist);
    } catch {
      // ignore
    }
  }, []);

  const originalKey = JSON.stringify({
    username: user.username,
    avatar: user.avatar ?? "",
    country: user.country ?? "",
    bio: user.bio,
    theme: user.theme,
    favoriteMode: user.favoriteMode,
  });
  const draftKey = JSON.stringify(draft);

  useEffect(() => {
    if (isGuest || draftKey === originalKey) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void onSave({
        ...draft,
        avatar: draft.avatar.trim() || null,
        country: draft.country.trim() || null,
      });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [draft, draftKey, onSave, originalKey, isGuest]);

  const ratingVal = user.rating ?? 1200;
  const rankInfo = getRankFromRating(ratingVal, user.placementMatchesPlayed != null && user.placementMatchesPlayed < 5);
  const winRate = user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 100) : 0;

  // Recalculate lifetime stats for guest PB & TPS display
  const localReplays = getLocalReplays();
  const stats = calculateLifetimeStats(localReplays);

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section
        className="profile-dialog"
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 170, damping: 20 }}
      >
        <div className="modal-head">
          <div>
            <span>{isGuest ? "Temporary Profile" : "Profile"}</span>
            <h2>{user.username}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close profile">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {isGuest ? (
          <div className="guest-upgrade-banner" style={{
            background: "linear-gradient(135deg, rgba(67, 56, 202, 0.2) 0%, rgba(99, 102, 241, 0.1) 100%)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "20px",
            textAlign: "center",
          }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#f1f5f9", fontWeight: 800 }}>Upgrade to persistent profile</h4>
            <p style={{ margin: "0 0 16px 0", fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.4 }}>
              Register or sign in with Google to save your competitive Elo rating, match history, and unlock custom profiles. Your local practice statistics will automatically merge!
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                className="ranked-gate-btn google"
                onClick={() => {
                  onClose();
                  void auth.startOAuth("google");
                }}
                style={{ width: "auto", minHeight: "36px", padding: "0 16px", fontSize: "0.8rem" }}
              >
                Sign Up with Google
              </button>
              <button
                type="button"
                className="ranked-gate-btn email"
                onClick={() => {
                  onClose();
                  auth.dismissFirstVisit();
                  onLogout(); // returns to sign in dialog
                }}
                style={{ width: "auto", minHeight: "36px", padding: "0 16px", fontSize: "0.8rem", background: "rgba(255,255,255,0.06)" }}
              >
                Sign Up with Email
              </button>
            </div>
          </div>
        ) : null}

        <div className="profile-summary">
          <div className="profile-avatar">{user.avatar ? <img src={user.avatar} alt="" /> : user.username.slice(0, 2).toUpperCase()}</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <strong style={{ color: "#22c55e", fontSize: "0.95rem" }}>{user.status === "online" ? "● Online" : "○ Offline"}</strong>
              {user.country ? (
                <span title={user.country} style={{ fontSize: "14px", cursor: "help" }}>
                  🏳️ {user.country}
                </span>
              ) : null}
            </div>
            <span>Joined {new Date(user.joinDate).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Premium Stats Grid */}
        <h3 style={{ fontSize: "0.88rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#60a5fa", margin: "20px 0 10px 0", fontWeight: 800 }}>
          Player Statistics
        </h3>
        <div className="profile-stats-grid" style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "10px",
          marginBottom: "24px",
        }}>
          {/* ELO Rating */}
          <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "14px", padding: "12px", position: "relative" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Rank Badge</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
              <Award size={18} style={{ color: rankInfo.color }} />
              <strong style={{ fontSize: "1.1rem", color: "#f1f5f9", fontWeight: 800 }}>{rankInfo.tier}</strong>
            </div>
          </div>

          <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "14px", padding: "12px" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Elo Rating</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "6px" }}>
              <strong style={{ fontSize: "1.1rem", color: "#f1f5f9", fontWeight: 800 }}>{ratingVal} ELO</strong>
              <small style={{ fontSize: "0.7rem", color: "#64748b" }}>Peak: {user.peakRating ?? ratingVal}</small>
            </div>
          </div>

          <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "14px", padding: "12px" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Games (W/L)</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "6px" }}>
              <strong style={{ fontSize: "1.1rem", color: "#f1f5f9", fontWeight: 800 }}>{user.gamesPlayed}</strong>
              <small style={{ fontSize: "0.7rem", color: "#64748b" }}>{user.wins}W - {user.losses}L ({winRate}%)</small>
            </div>
          </div>

          <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "14px", padding: "12px" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Practice PB</span>
            <div style={{ marginTop: "6px" }}>
              <strong style={{ fontSize: "1.1rem", color: "#818cf8", fontWeight: 800 }}>
                {stats.pbMs ? formatTime(stats.pbMs) : "-"}
              </strong>
            </div>
          </div>

          <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "14px", padding: "12px" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Average TPS</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "6px" }}>
              <strong style={{ fontSize: "1.1rem", color: "#10b981", fontWeight: 800 }}>{stats.avgTps} t/s</strong>
              <small style={{ fontSize: "0.7rem", color: "#64748b" }}>Max: {stats.fastestTps}</small>
            </div>
          </div>

          <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "14px", padding: "12px" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Bot Race W/L</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "6px" }}>
              <strong style={{ fontSize: "1.1rem", color: "#f1f5f9", fontWeight: 800 }}>{user.botWins + user.botLosses}</strong>
              <small style={{ fontSize: "0.7rem", color: "#64748b" }}>{user.botWins}W - {user.botLosses}L</small>
            </div>
          </div>
        </div>

        <div className="auth-fields">
          <label>
            <span>Username</span>
            <input value={draft.username} disabled={isGuest} placeholder={isGuest ? auth.guestUsername : "Your username"} onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))} />
          </label>
          <label>
            <span>Avatar URL</span>
            <input value={draft.avatar} disabled={isGuest} placeholder={isGuest ? "Google URL (Locked)" : "https://domain.com/image.png"} onChange={(event) => setDraft((current) => ({ ...current, avatar: event.target.value }))} />
          </label>
          <label>
            <span>Country Code / Name</span>
            <input value={draft.country} disabled={isGuest} placeholder={isGuest ? "US / IN / GB (Locked)" : "US / IN / GB / Canada"} onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))} />
          </label>
          <label>
            <span>Favorite Mode</span>
            <input value={draft.favoriteMode} disabled={isGuest} placeholder={isGuest ? "Practice (Locked)" : "Practice / Ranked"} onChange={(event) => setDraft((current) => ({ ...current, favoriteMode: event.target.value }))} />
          </label>
          <label>
            <span>Bio</span>
            <textarea value={draft.bio} disabled={isGuest} placeholder={isGuest ? "Sign in to customize bio..." : "Add your cuber description..."} onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))} maxLength={220} />
          </label>
        </div>

        <div className="profile-private-history">
          <h3 style={{ fontSize: "0.88rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#60a5fa", margin: "24px 0 10px 0", fontWeight: 800 }}>
            Private Match History
          </h3>
          {privateHistory.length === 0 ? (
            <p className="no-history-text" style={{ color: "#475569", fontSize: "0.82rem", fontStyle: "italic", margin: "4px 0" }}>No private matches played yet.</p>
          ) : (
            <div className="history-list">
              {privateHistory.map((item: any) => (
                <div key={item.id} className="history-item">
                  <div className="history-meta">
                    <strong>vs {item.opponent}</strong>
                    <span>{new Date(item.date).toLocaleDateString()}</span>
                  </div>
                  <div className="history-stats">
                    <span className="time-badge">{item.timeMs ? formatTime(item.timeMs) : "DNF"}</span>
                    <span className={`winner-badge ${item.winner === "You" ? "win" : "loss"}`}>
                      {item.winner === "You" ? "WON" : "LOST"}
                    </span>
                    <small className="replay-tag">{item.replayId}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="theme-toggle-container">
          <button
            className={`premium-theme-toggle ${draft.theme === "dark" ? "is-dark" : "is-light"}`}
            onClick={() => setDraft((current) => ({ ...current, theme: current.theme === "dark" ? "light" : "dark" }))}
            aria-label="Toggle theme"
          >
            <motion.div
              className="theme-toggle-orb"
              layout
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              {draft.theme === "dark" ? (
                <Moon size={14} className="theme-icon-dark" />
              ) : (
                <Sun size={14} className="theme-icon-light" />
              )}
            </motion.div>
            <div className="theme-toggle-bg" />
          </button>
        </div>

        {!isGuest && (
          <button type="button" className="profile-logout" onClick={onLogout}>
            <LogOut size={16} aria-hidden="true" />
            Logout
          </button>
        )}
      </motion.section>
    </motion.div>
  );
}

function KeyboardCheatSheet({ settings }: { settings: SessionSettings }) {
  const bindings = settings.keybindings || DEFAULT_SETTINGS.keybindings;

  const moveRows: Array<{ key: string; shift?: string; label: string }> = [
    { key: bindings.R || "R", shift: `Shift+${bindings.R || "R"}`, label: "Right" },
    { key: bindings.L || "L", shift: `Shift+${bindings.L || "L"}`, label: "Left" },
    { key: bindings.U || "U", shift: `Shift+${bindings.U || "U"}`, label: "Up" },
    { key: bindings.D || "D", shift: `Shift+${bindings.D || "D"}`, label: "Down" },
    { key: bindings.F || "F", shift: `Shift+${bindings.F || "F"}`, label: "Front" },
    { key: bindings.B || "B", shift: `Shift+${bindings.B || "B"}`, label: "Back" },
  ];

  const cameraRows = [
    { key: "Mouse Drag", label: "Rotate View" },
    { key: "Scroll", label: "Zoom" },
  ];

  const actionRows = [
    { key: "Space", label: "Inspect / Start" },
    { key: "Esc", label: "Pause" },
  ];

  return (
    <motion.aside
      className="kbd-panel"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 26 }}
    >
      <div className="kbd-panel-header">
        <Keyboard size={13} aria-hidden="true" />
        <span>Controls</span>
      </div>

      <div className="kbd-section">
        <div className="kbd-section-label">Moves</div>
        {moveRows.map((row) => (
          <div key={row.key} className="kbd-row">
            <div className="kbd-keys">
              <kbd className="kbd-key">{row.key}</kbd>
              {row.shift && <kbd className="kbd-key modifier">{row.shift}</kbd>}
            </div>
            <span className="kbd-label">{row.label}</span>
          </div>
        ))}
      </div>

      <div className="kbd-section">
        <div className="kbd-section-label">Camera</div>
        {cameraRows.map((row) => (
          <div key={row.key} className="kbd-row">
            <div className="kbd-keys">
              <kbd className="kbd-key">{row.key}</kbd>
            </div>
            <span className="kbd-label">{row.label}</span>
          </div>
        ))}
      </div>

      <div className="kbd-section">
        <div className="kbd-section-label">Actions</div>
        {actionRows.map((row) => (
          <div key={row.key} className="kbd-row">
            <div className="kbd-keys">
              <kbd className="kbd-key">{row.key}</kbd>
            </div>
            <span className="kbd-label">{row.label}</span>
          </div>
        ))}
      </div>
    </motion.aside>
  );
}

function buildCloudStatistics(history: SolveRecord[], botStats: BotRaceStats): UserStatistics {
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
