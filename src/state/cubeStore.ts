import { create } from "zustand";
import {
  applyMove,
  createScramble,
  createSolvedCube,
  invertMove,
  makeMove,
  parseMove,
  serializeCube,
  type CubeState,
  type Face,
  type Move,
} from "../lib/cubeEngine";
import { cubeFromScramble } from "../lib/scramble";

export type TurnMode = "normal" | "prime" | "double";

export interface ActiveMove {
  move: Move;
  startCube: CubeState;
  progress: number;
}

interface CubeStore {
  cube: CubeState;
  activeMove: ActiveMove | null;
  moveQueue: Move[];
  history: Move[];
  redoStack: Move[];
  turnMode: TurnMode;
  turnDuration: number;
  enqueueMove: (move: Move) => void;
  enqueuePracticeMove: (move: Move) => void;
  playFace: (face: Face) => void;
  playMoves: (moves: Move[]) => void;
  tick: (deltaSeconds: number) => void;
  resetCube: () => void;
  setCubeFromScramble: (scramble: string[]) => void;
  scrambleCube: () => void;
  undoLast: () => void;
  redoLast: () => void;
  clearRedo: () => void;
  isSolved: () => boolean;
  setTurnMode: (mode: TurnMode) => void;
  setTurnDuration: (duration: number) => void;
}

export const useCubeStore = create<CubeStore>((set, get) => ({
  cube: createSolvedCube(),
  activeMove: null,
  moveQueue: [],
  history: [],
  redoStack: [],
  turnMode: "normal",
  turnDuration: 0.24,

  enqueueMove: (move) => {
    set((state) => {
      if (state.activeMove) {
        return { moveQueue: [...state.moveQueue, move] };
      }

      return {
        activeMove: {
          move,
          startCube: state.cube,
          progress: 0,
        },
      };
    });
  },

  enqueuePracticeMove: (move) => {
    set({ redoStack: [] });
    get().enqueueMove(move);
  },

  playFace: (face) => {
    get().enqueuePracticeMove(makeMove(face, get().turnMode));
  },

  playMoves: (moves) => {
    set((state) => {
      if (moves.length === 0) {
        return {};
      }

      if (state.activeMove) {
        return { moveQueue: [...state.moveQueue, ...moves] };
      }

      const [firstMove, ...queuedMoves] = moves;
      return {
        activeMove: {
          move: firstMove,
          startCube: state.cube,
          progress: 0,
        },
        moveQueue: [...state.moveQueue, ...queuedMoves],
      };
    });
  },

  tick: (deltaSeconds) => {
    set((state) => {
      if (!state.activeMove) {
        if (state.moveQueue.length === 0) {
          return {};
        }

        const [nextMove, ...rest] = state.moveQueue;
        return {
          activeMove: {
            move: nextMove,
            startCube: state.cube,
            progress: 0,
          },
          moveQueue: rest,
        };
      }

      const progress = Math.min(
        1,
        state.activeMove.progress + deltaSeconds / state.turnDuration,
      );

      if (progress < 1) {
        return {
          activeMove: {
            ...state.activeMove,
            progress,
          },
        };
      }

      const cube = applyMove(state.activeMove.startCube, state.activeMove.move);
      const history = [...state.history, state.activeMove.move].slice(-24);
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
    });
  },

  resetCube: () => {
    set({
      cube: createSolvedCube(),
      activeMove: null,
      moveQueue: [],
      history: [],
      redoStack: [],
    });
  },

  setCubeFromScramble: (scramble) => {
    set({
      cube: cubeFromScramble(scramble),
      activeMove: null,
      moveQueue: [],
      history: [],
      redoStack: [],
    });
  },

  scrambleCube: () => {
    get().playMoves(createScramble(22));
  },

  undoLast: () => {
    const lastMove = get().history.at(-1);

    if (!lastMove) {
      return;
    }

    set((state) => ({
      history: state.history.slice(0, -1),
      redoStack: [lastMove, ...state.redoStack].slice(0, 24),
    }));
    get().enqueueMove(invertMove(lastMove));
  },

  redoLast: () => {
    const nextMove = get().redoStack[0];

    if (!nextMove) {
      return;
    }

    set((state) => ({
      redoStack: state.redoStack.slice(1),
    }));
    get().enqueueMove(nextMove);
  },

  clearRedo: () => {
    set({ redoStack: [] });
  },

  isSolved: () => {
    return serializeCube(get().cube) === serializeCube(createSolvedCube());
  },

  setTurnMode: (mode) => {
    set({ turnMode: mode });
  },

  setTurnDuration: (duration) => {
    set({ turnDuration: duration });
  },
}));
