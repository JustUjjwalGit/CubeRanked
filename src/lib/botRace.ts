import {
  applyMove,
  createSolvedCube,
  invertMove,
  makeMove,
  parseMove,
  serializeCube,
  type CubeState,
  type Face,
  type Move,
} from "./cubeEngine";
import { cubeFromScramble } from "./scramble";

export type RaceOpponentSource = "bot" | "socket";
export type RacePlayerStatus = "ready" | "inspection" | "solving" | "finished" | "dnf";
export type BotDifficulty = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export interface RaceOpponentSnapshot {
  id: string;
  source: RaceOpponentSource;
  name: string;
  avatar: string;
  avatarColor: string;
  difficultyLabel?: string;
  status: RacePlayerStatus;
  elapsedMs: number;
  finalTimeMs: number | null;
  moveCount: number;
  pingMs?: number | null;
}

export interface BotProfile {
  difficulty: BotDifficulty;
  tpsRange: readonly [number, number];
  mistakeChance: number;
  pauseChance: number;
  recognitionDelayMs: readonly [number, number];
  pauseMs: readonly [number, number];
  hesitationChance: number;
  hesitationMs: readonly [number, number];
  burstChance: number;
  turnDuration: number;
}

export interface BotPlannedMove {
  move: Move;
  atMs: number;
}

export interface BotOpponent extends RaceOpponentSnapshot {
  source: "bot";
  difficultyLabel: BotDifficulty;
  profile: BotProfile;
  averageTps: number;
  plan: BotPlannedMove[];
  projectedTimeMs: number;
}

export interface ActiveAnimatedMove {
  move: Move;
  startCube: CubeState;
  progress: number;
}

export interface AnimatedCubeState {
  cube: CubeState;
  activeMove: ActiveAnimatedMove | null;
  moveQueue: Move[];
  history: Move[];
}

const BOT_NAMES = [
  "CubeMaster",
  "OLLWizard",
  "PLLHunter",
  "FastHands",
  "Cuber47",
  "TPSMonster",
  "SpeedEdge",
  "Lookahead",
  "CrossBoss",
  "TurnFlow",
];

const AVATAR_COLORS = [
  "#3b82f6",
  "#14b8a6",
  "#f97316",
  "#a855f7",
  "#22c55e",
  "#ef4444",
  "#f59e0b",
];

export const BOT_PROFILES: BotProfile[] = [
  {
    difficulty: "Beginner",
    tpsRange: [2, 3],
    mistakeChance: 0.16,
    pauseChance: 0.32,
    recognitionDelayMs: [800, 1_500],
    pauseMs: [50, 300],
    hesitationChance: 0.58,
    hesitationMs: [450, 900],
    burstChance: 0.06,
    turnDuration: 0.28,
  },
  {
    difficulty: "Intermediate",
    tpsRange: [4, 5],
    mistakeChance: 0.1,
    pauseChance: 0.24,
    recognitionDelayMs: [400, 800],
    pauseMs: [50, 300],
    hesitationChance: 0.4,
    hesitationMs: [260, 620],
    burstChance: 0.1,
    turnDuration: 0.2,
  },
  {
    difficulty: "Advanced",
    tpsRange: [6, 8],
    mistakeChance: 0.055,
    pauseChance: 0.16,
    recognitionDelayMs: [200, 500],
    pauseMs: [50, 300],
    hesitationChance: 0.26,
    hesitationMs: [140, 420],
    burstChance: 0.16,
    turnDuration: 0.15,
  },
  {
    difficulty: "Expert",
    tpsRange: [9, 11],
    mistakeChance: 0.025,
    pauseChance: 0.1,
    recognitionDelayMs: [50, 200],
    pauseMs: [50, 300],
    hesitationChance: 0.14,
    hesitationMs: [70, 220],
    burstChance: 0.22,
    turnDuration: 0.11,
  },
];

export function createBotOpponent(scramble: string[]): BotOpponent {
  const profile = randomItem(BOT_PROFILES);
  const averageTps = randomRange(profile.tpsRange);
  const solution = invertScramble(scramble);
  const plan = createHumanizedPlan(solution, profile, averageTps);
  const name = randomBotName();
  const projectedTimeMs = Math.ceil((plan.at(-1)?.atMs ?? 0) + profile.turnDuration * 1_000);

  return {
    id: crypto.randomUUID() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    source: "bot",
    name,
    avatar: createAvatar(name),
    avatarColor: randomItem(AVATAR_COLORS),
    difficultyLabel: profile.difficulty,
    status: "inspection",
    elapsedMs: 0,
    finalTimeMs: null,
    moveCount: 0,
    profile,
    averageTps,
    plan,
    projectedTimeMs,
  };
}

export function createAnimatedCubeFromScramble(scramble: string[]): AnimatedCubeState {
  return {
    cube: cubeFromScramble(scramble),
    activeMove: null,
    moveQueue: [],
    history: [],
  };
}

export function enqueueAnimatedMove(state: AnimatedCubeState, move: Move): AnimatedCubeState {
  if (state.activeMove) {
    return {
      ...state,
      moveQueue: [...state.moveQueue, move],
    };
  }

  return {
    ...state,
    activeMove: {
      move,
      startCube: state.cube,
      progress: 0,
    },
  };
}

export function advanceAnimatedCube(
  state: AnimatedCubeState,
  deltaSeconds: number,
  turnDuration: number,
): AnimatedCubeState {
  if (!state.activeMove) {
    if (state.moveQueue.length === 0) {
      return state;
    }

    const [nextMove, ...rest] = state.moveQueue;
    return {
      ...state,
      activeMove: {
        move: nextMove,
        startCube: state.cube,
        progress: 0,
      },
      moveQueue: rest,
    };
  }

  const progress = Math.min(1, state.activeMove.progress + deltaSeconds / turnDuration);

  if (progress < 1) {
    return {
      ...state,
      activeMove: {
        ...state.activeMove,
        progress,
      },
    };
  }

  const cube = applyMove(state.activeMove.startCube, state.activeMove.move);
  const history = [...state.history, state.activeMove.move];
  const [nextMove, ...rest] = state.moveQueue;

  if (nextMove) {
    return {
      cube,
      history,
      activeMove: {
        move: nextMove,
        startCube: cube,
        progress: 0,
      },
      moveQueue: rest,
    };
  }

  return {
    cube,
    history,
    activeMove: null,
    moveQueue: [],
  };
}

export function isAnimatedCubeSolved(cube: CubeState): boolean {
  return serializeCube(cube) === serializeCube(createSolvedCube());
}

export function statusText(status: RacePlayerStatus): string {
  if (status === "inspection") return "Inspection";
  if (status === "solving") return "Solving";
  if (status === "finished") return "Finished";
  if (status === "dnf") return "DNF";
  return "Ready";
}

function invertScramble(scramble: string[]): Move[] {
  return scramble
    .map((notation) => parseMove(notation))
    .reverse()
    .map((move) => invertMove(move));
}

function createHumanizedPlan(solution: Move[], profile: BotProfile, averageTps: number): BotPlannedMove[] {
  const plan: BotPlannedMove[] = [];
  let cursor = randomRange(profile.recognitionDelayMs);

  for (const [index, move] of solution.entries()) {
    if (isOllPllBoundary(index, solution.length) && Math.random() < profile.hesitationChance) {
      cursor += randomRange(profile.hesitationMs);
    }

    if (Math.random() < profile.pauseChance) {
      cursor += randomRange(profile.pauseMs);
    }

    const burstMultiplier = Math.random() < profile.burstChance ? randomBetween(0.42, 0.68) : 1;
    cursor += nextMoveInterval(averageTps) * burstMultiplier;
    plan.push({ move, atMs: cursor });

    if (Math.random() < profile.mistakeChance) {
      const mistake = createMistakeMove(move.face);
      cursor += nextMoveInterval(averageTps) * randomBetween(0.75, 1.35);
      plan.push({ move: mistake, atMs: cursor });
      cursor += randomRange(profile.pauseMs) + nextMoveInterval(averageTps);
      plan.push({ move: invertMove(mistake), atMs: cursor });
    }
  }

  return plan;
}

function createMistakeMove(previousFace: Face): Move {
  const faces: Face[] = ["U", "R", "F", "D", "L", "B"];
  const modes = ["normal", "prime", "double"] as const;
  let face = randomItem(faces);

  while (face === previousFace) {
    face = randomItem(faces);
  }

  return makeMove(face, randomItem(modes));
}

function nextMoveInterval(averageTps: number): number {
  const jitter = randomBetween(0.72, 1.42);
  return (1_000 / averageTps) * jitter;
}

function isOllPllBoundary(index: number, length: number): boolean {
  return index === Math.max(0, length - 8) || index === Math.max(0, length - 4);
}

function randomBotName(): string {
  const base = randomItem(BOT_NAMES);

  if (base === "Cuber47" || Math.random() > 0.82) {
    return `${base}${Math.floor(randomBetween(10, 99))}`;
  }

  return base;
}

function createAvatar(name: string): string {
  const letters = name.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase();
  return letters || "CR";
}

function randomRange(range: readonly [number, number]): number {
  return randomBetween(range[0], range[1]);
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
