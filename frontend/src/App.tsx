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
  Zap,
  Globe,
  GraduationCap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type FormEvent } from "react";
import CubeScene from "./components/cube/CubeScene";
import AppBackground from "./components/AppBackground";
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
} from "./utils/botRace";
import { getRelativeFace, makeMove, MOVE_FACES, parseMove, type Face } from "./utils/cubeEngine";
import { generateWcaScramble, scrambleToString, type Penalty } from "./utils/scramble";
import {
  createSolveRecord,
  calculateStats,
  DEFAULT_SETTINGS,
  formatSolveTime,
  formatTime,
  type SessionSettings,
  type SolveRecord,
} from "./utils/sessionStats";
import { getRankFromRating, isRankPromotion } from "./utils/ranks";
import { saveReplay, getLocalReplays } from "./utils/replay";
import { calculateLifetimeStats } from "./utils/statsEngine";
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
import { useAuth } from "./features/auth/AuthContext";
import type { UserProfile, UserStatistics } from "./api/auth";
import { audioManager } from "./utils/audioManager";
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
import { loadSettings, loadHistory, loadBotRaceStats } from "./utils/storage";
import {
  buildCloudStatistics,
  stateLabel,
  connectionLabel,
  inverseTurnMode,
  snapshotToOpponent,
  resultToRaceResult,
} from "./utils/helpers";
import HomeScreen from "./features/home/HomeScreen";
import LoadingScreen from "./components/LoadingScreen";
import QueueScreen from "./components/QueueScreen";
import PlayModal from "./components/PlayModal";
import PrivateLobbyScreen from "./features/private-room/PrivateLobbyScreen";
import PracticeScreen from "./features/practice/PracticeScreen";
import OpponentPanel from "./components/OpponentPanel";
import DeveloperOverlay from "./components/DeveloperOverlay";
import CountdownOverlay from "./components/CountdownOverlay";
import ReadyOverlay from "./components/ReadyOverlay";
import InspectionOverlay from "./components/InspectionOverlay";
import SolvedOverlay from "./components/SolvedOverlay";
import CompactTimer from "./components/CompactTimer";
import ResultsModal from "./components/ResultsModal";
import PauseMenu from "./components/PauseMenu";
import PracticeSettingsPopover from "./components/PracticeSettingsPopover";
import AppSettingsDialog from "./components/AppSettingsDialog";
import ProfileDialog from "./features/profile/ProfileDialog";
import KeyboardCheatSheet from "./components/KeyboardCheatSheet";
import LearnMode from "./features/learn/LearnMode";
import IdentityScreen from "./features/auth/IdentityScreen";
import RankedGateModal from "./features/ranked/RankedGateModal";
import RankPromotionAnimation from "./features/profile/RankPromotionAnimation";
import SocialSidebar from "./features/profile/SocialSidebar";
import { AchievementToast, type ToastAchievement } from "./features/achievements/AchievementToast";
import { sendAchievementEvent } from "./api/achievements";
import type { AchievementEvent } from "./features/achievements/achievement.types";

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
type SettingsCategory = "General" | "Appearance" | "Camera" | "Controls" | "Cube" | "Audio";
type AuthModal = "none" | "profile";

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
  const [promotionData, setPromotionData] = useState<{ rank: import("./utils/ranks").RankInfo, isPromotion: boolean } | null>(null);
  const [achievementToastQueue, setAchievementToastQueue] = useState<ToastAchievement[]>([]);
  const achievementToastDismiss = useCallback((id: string) => {
    setAchievementToastQueue((q) => q.filter((a) => a.id !== id));
  }, []);
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

  const triggerAchievementEvent = useCallback(async (
    type: AchievementEvent["type"],
    data: Record<string, unknown> = {},
  ) => {
    if (auth.mode !== "authenticated") return;
    try {
      const result = await sendAchievementEvent({ type, data });
      if (result.newlyUnlocked.length > 0) {
        const toastQueue: ToastAchievement[] = result.newlyUnlocked.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          icon: a.icon,
          rarity: a.rarity,
          category: a.category,
        }));
        setAchievementToastQueue((q) => [...q, ...toastQueue]);
      }
    } catch {
      // silently ignore
    }
  }, [auth.mode]);

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
  const currentViewFace = useCubeStore((state) => state.currentViewFace);
  const setViewFace = useCubeStore((state) => state.setViewFace);

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
    setSettings((current) => {
      const merged = { ...current };
      for (const key of Object.keys(next) as (keyof SessionSettings)[]) {
        const currentVal = current[key];
        const nextVal = next[key];
        if (
          nextVal !== null &&
          nextVal !== undefined &&
          typeof currentVal === "object" &&
          typeof nextVal === "object" &&
          !Array.isArray(currentVal) &&
          !Array.isArray(nextVal)
        ) {
          (merged as any)[key] = { ...currentVal, ...nextVal };
        } else if (nextVal !== undefined) {
          (merged as any)[key] = nextVal;
        }
      }
      return merged;
    });
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

    if (stage === "INSPECTION" && inspectionStartRef.current > 0) {
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
    audioManager.startBgm();
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.cubeStyle = settings.cubeStyle;
    document.documentElement.dataset.reducedMotion = settings.reducedMotion ? "true" : "false";
    document.documentElement.style.setProperty("--ui-scale", String(settings.uiScale));
    audioManager.setMasterVolume(settings.audio.masterVolume);
    audioManager.setSfxVolume(settings.audio.sfxVolume);
    audioManager.setUiVolume(settings.audio.uiVolume);
    audioManager.setNotifVolume(settings.audio.notificationVolume);
    audioManager.setMusicVolume(settings.audio.musicVolume);
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
      audioManager.playMatchFound();
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
          const { promoted, demoted, newRank } = isRankPromotion(myUpdate.previousRating, myUpdate.newRating);
          if (promoted) {
            setPromotionData({ rank: newRank, isPromotion: true });
          } else if (demoted) {
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

  // Play notification sound when invite or friend request arrives
  useEffect(() => {
    if (socketSnapshot.incomingInvite) {
      audioManager.playNotification();
    }
  }, [socketSnapshot.incomingInvite]);

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
      window.setTimeout(() => { setCountdownValue("2"); }, 600),
      window.setTimeout(() => { setCountdownValue("1"); }, 1_200),
      window.setTimeout(() => { setCountdownValue("GO"); audioManager.playGo(); }, 1_600),
      window.setTimeout(() => {
        const now = performance.now();
        solveStartRef.current = now;
        setElapsedMs(0);
        setBotOpponent((current) => current ? { ...current, status: "solving" } : current);
        dispatch({ type: "COUNTDOWN_COMPLETE" });
      }, 2_000),
    ];

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [gameMode, overlay, stage]);

  useEffect(() => {
    if (overlay !== "NONE") return;

    console.log({
      stage,
      cubeLocked: activeMove !== null,
      inputBlocked: overlay !== "NONE" || stage === "MODE_SELECT" || stage === "MATCH_LOADING" || stage === "RESULT",
      solveStarted: solveStartRef.current > 0,
      inspectionTime: inspectionElapsedMs,
    });

    if (stage === "READY" && isBotRace) {
      solveStartRef.current = performance.now();
      replayMovesRef.current = [];
      setElapsedMs(0);
      setSolveMoveCount(0);
      dispatch({ type: "FIRST_MOVE" });
    } else if (stage === "READY" && effectiveInspectionEnabled) {
      beginInspection();
    }
  }, [stage, effectiveInspectionEnabled, overlay, beginInspection, isBotRace]);

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

    if (stage === "INSPECTION" && inspectionStartRef.current <= 0) {
      return;
    }

    if (stage === "PLAYING" && solveStartRef.current <= 0) {
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
      } else if (stage === "INSPECTION" && inspectionStartRef.current > 0) {
        const inspectionMs = now - inspectionStartRef.current;
        setInspectionElapsedMs(inspectionMs);
        setPenalty(inspectionMs > 17_000 ? "DNF" : inspectionMs > 15_000 ? "+2" : "none");
        console.log({
          stage,
          cubeLocked: activeMove !== null,
          inputBlocked: overlay !== "NONE",
          solveStarted: solveStartRef.current > 0,
          inspectionTime: inspectionElapsedMs,
        });
        if (inspectionMs >= 15_000 && solveStartRef.current === 0) {
          solveStartRef.current = performance.now();
          replayMovesRef.current = [];
          setElapsedMs(0);
          setSolveMoveCount(0);
          dispatch({ type: "FIRST_MOVE" });
        }
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
        const actualFace = getRelativeFace(currentViewFace, face);
        playFace(actualFace, event.shiftKey ? inverseTurnMode(turnMode) : turnMode);
        return;
      }

      const numberKey = event.key;
      if (numberKey >= "1" && numberKey <= "6") {
        event.preventDefault();
        const faceMap: Record<string, Face> = { "1": "F", "2": "L", "3": "R", "4": "B", "5": "U", "6": "D" };
        setViewFace(faceMap[numberKey]);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    beginInspection,
    cancelRankedQueue,
    currentViewFace,
    overlay,
    playFace,
    redoPracticeMove,
    requestNewScramble,
    settings.hudVisible,
    setViewFace,
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
              auth.dismissFirstVisit();
            }}
            onGoogle={() => {
              auth.dismissFirstVisit();
              void auth.loginWithGoogle();
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
              onLogin={() => void auth.loginWithGoogle()}
              onGuest={auth.continueAsGuest}
              onProfile={() => setAuthModal("profile")}
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
            />
          ) : stage === "MATCHMAKING" ? (
            <QueueScreen
              key="queue"
              queue={queueUpdate}
              connectionState={socketSnapshot.connectionState}
              onCancel={cancelRankedQueue}
              userElo={auth.user?.rating}
              userPlacementMatches={auth.user?.placementMatchesPlayed}
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
              void auth.loginWithGoogle();
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

      <AchievementToast queue={achievementToastQueue} onDismiss={achievementToastDismiss} />

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
