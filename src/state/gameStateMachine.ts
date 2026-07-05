export type GameStage =
  | "HOME"
  | "MODE_SELECT"
  | "MATCHMAKING"
  | "MATCH_LOADING"
  | "COUNTDOWN"
  | "READY"
  | "INSPECTION"
  | "PLAYING"
  | "SOLVED"
  | "RESULT";

export type GameMode = "practice" | "bot-race" | "ranked";

export type GameOverlay =
  | "NONE"
  | "APP_SETTINGS"
  | "PRACTICE_SETTINGS"
  | "PAUSE_MENU";

export interface GameState {
  stage: GameStage;
  overlay: GameOverlay;
  loadingId: number;
  mode: GameMode | null;
}

export type GameEvent =
  | { type: "OPEN_MODE_SELECT" }
  | { type: "CLOSE_MODE_SELECT" }
  | { type: "SELECT_PRACTICE" }
  | { type: "SELECT_BOT_RACE" }
  | { type: "SELECT_RANKED" }
  | { type: "QUEUE_CANCELLED" }
  | { type: "MATCH_FOUND" }
  | { type: "LOADING_COMPLETE" }
  | { type: "START_COUNTDOWN" }
  | { type: "COUNTDOWN_COMPLETE" }
  | { type: "START_INSPECTION" }
  | { type: "FIRST_MOVE" }
  | { type: "SOLVE_COMPLETE" }
  | { type: "SHOW_RESULTS" }
  | { type: "PRACTICE_AGAIN" }
  | { type: "NEW_SCRAMBLE" }
  | { type: "BACK_HOME" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "RESTART_SOLVE" }
  | { type: "OPEN_APP_SETTINGS" }
  | { type: "OPEN_PRACTICE_SETTINGS" }
  | { type: "CLOSE_OVERLAY" };

export const initialGameState: GameState = {
  stage: "HOME",
  overlay: "NONE",
  loadingId: 0,
  mode: null,
};

export function gameStateReducer(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case "OPEN_MODE_SELECT":
      if (state.stage !== "HOME") return state;
      return { ...state, stage: "MODE_SELECT", overlay: "NONE" };

    case "CLOSE_MODE_SELECT":
      if (state.stage !== "MODE_SELECT") return state;
      return { ...state, stage: "HOME", overlay: "NONE" };

    case "SELECT_PRACTICE":
      if (state.stage !== "MODE_SELECT" && state.stage !== "HOME") return state;
      return {
        stage: "MATCH_LOADING",
        overlay: "NONE",
        loadingId: state.loadingId + 1,
        mode: "practice",
      };

    case "SELECT_BOT_RACE":
      if (state.stage !== "MODE_SELECT" && state.stage !== "HOME") return state;
      return {
        stage: "MATCH_LOADING",
        overlay: "NONE",
        loadingId: state.loadingId + 1,
        mode: "bot-race",
      };

    case "SELECT_RANKED":
      if (state.stage !== "MODE_SELECT" && state.stage !== "HOME") return state;
      return {
        ...state,
        stage: "MATCHMAKING",
        overlay: "NONE",
        mode: "ranked",
      };

    case "QUEUE_CANCELLED":
      if (state.stage !== "MATCHMAKING") return state;
      return { ...state, stage: "MODE_SELECT", overlay: "NONE", mode: null };

    case "MATCH_FOUND":
      if (state.stage !== "MATCHMAKING" && state.stage !== "HOME" && state.stage !== "MODE_SELECT") return state;
      return {
        stage: "MATCH_LOADING",
        overlay: "NONE",
        loadingId: state.loadingId + 1,
        mode: "ranked",
      };

    case "LOADING_COMPLETE":
      if (state.stage !== "MATCH_LOADING") return state;
      return { ...state, stage: state.mode === "bot-race" ? "COUNTDOWN" : "READY", overlay: "NONE" };

    case "START_COUNTDOWN":
      if (state.stage !== "MATCH_LOADING" && state.stage !== "READY") return state;
      return { ...state, stage: "COUNTDOWN", overlay: "NONE" };

    case "COUNTDOWN_COMPLETE":
      if (state.stage !== "COUNTDOWN") return state;
      return { ...state, stage: "PLAYING", overlay: "NONE" };

    case "START_INSPECTION":
      if (state.stage !== "READY") return state;
      return { ...state, stage: "INSPECTION", overlay: "NONE" };

    case "FIRST_MOVE":
      if (state.stage !== "READY" && state.stage !== "INSPECTION") return state;
      return { ...state, stage: "PLAYING", overlay: "NONE" };

    case "SOLVE_COMPLETE":
      if (state.stage !== "PLAYING") return state;
      return { ...state, stage: "SOLVED", overlay: "NONE" };

    case "SHOW_RESULTS":
      if (state.stage !== "SOLVED") return state;
      return { ...state, stage: "RESULT", overlay: "NONE" };

    case "PRACTICE_AGAIN":
    case "RESTART_SOLVE":
      if (!isPracticeStage(state.stage)) return state;
      return { ...state, stage: state.mode === "bot-race" ? "COUNTDOWN" : "READY", overlay: "NONE" };

    case "NEW_SCRAMBLE":
      if (!isPracticeStage(state.stage)) return state;
      return {
        stage: "MATCH_LOADING",
        overlay: "NONE",
        loadingId: state.loadingId + 1,
        mode: state.mode,
      };

    case "BACK_HOME":
      return { ...state, stage: "HOME", overlay: "NONE", mode: null };

    case "PAUSE":
      if (!isPausableStage(state.stage) || state.overlay !== "NONE") return state;
      return { ...state, overlay: "PAUSE_MENU" };

    case "RESUME":
      if (state.overlay !== "PAUSE_MENU") return state;
      return { ...state, overlay: "NONE" };

    case "OPEN_APP_SETTINGS":
      return { ...state, overlay: "APP_SETTINGS" };

    case "OPEN_PRACTICE_SETTINGS":
      if (!isPracticeStage(state.stage)) return state;
      return { ...state, overlay: "PRACTICE_SETTINGS" };

    case "CLOSE_OVERLAY":
      if (state.overlay === "NONE") return state;
      return { ...state, overlay: "NONE" };

    default:
      return state;
  }
}

export function isPracticeStage(stage: GameStage): boolean {
  return (
    stage === "COUNTDOWN"
    || stage === "READY"
    || stage === "INSPECTION"
    || stage === "PLAYING"
    || stage === "SOLVED"
    || stage === "RESULT"
  );
}

export function isPausableStage(stage: GameStage): boolean {
  return stage === "READY" || stage === "INSPECTION" || stage === "PLAYING" || stage === "SOLVED";
}
