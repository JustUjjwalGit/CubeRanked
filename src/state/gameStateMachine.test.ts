import { describe, expect, it } from "vitest";
import { gameStateReducer, initialGameState } from "./gameStateMachine";

describe("gameStateReducer", () => {
  it("drives the offline practice flow through loading, ready, play, solved, and result", () => {
    const modeSelect = gameStateReducer(initialGameState, { type: "OPEN_MODE_SELECT" });
    expect(modeSelect.stage).toBe("MODE_SELECT");

    const loading = gameStateReducer(modeSelect, { type: "SELECT_PRACTICE" });
    expect(loading.stage).toBe("MATCH_LOADING");
    expect(loading.loadingId).toBe(1);
    expect(loading.mode).toBe("practice");

    const ready = gameStateReducer(loading, { type: "LOADING_COMPLETE" });
    expect(ready.stage).toBe("READY");

    const inspection = gameStateReducer(ready, { type: "START_INSPECTION" });
    expect(inspection.stage).toBe("INSPECTION");

    const playing = gameStateReducer(inspection, { type: "FIRST_MOVE" });
    expect(playing.stage).toBe("PLAYING");

    const solved = gameStateReducer(playing, { type: "SOLVE_COMPLETE" });
    expect(solved.stage).toBe("SOLVED");

    const result = gameStateReducer(solved, { type: "SHOW_RESULTS" });
    expect(result.stage).toBe("RESULT");
  });

  it("keeps pause as an overlay instead of replacing gameplay state", () => {
    const ready = gameStateReducer(
      gameStateReducer(
        gameStateReducer(initialGameState, { type: "OPEN_MODE_SELECT" }),
        { type: "SELECT_PRACTICE" },
      ),
      { type: "LOADING_COMPLETE" },
    );

    const paused = gameStateReducer(ready, { type: "PAUSE" });
    expect(paused.stage).toBe("READY");
    expect(paused.overlay).toBe("PAUSE_MENU");

    const resumed = gameStateReducer(paused, { type: "RESUME" });
    expect(resumed.stage).toBe("READY");
    expect(resumed.overlay).toBe("NONE");
  });

  it("routes new scrambles back through match loading", () => {
    const result = {
      stage: "RESULT",
      overlay: "NONE",
      loadingId: 4,
      mode: "practice",
    } as const;

    const next = gameStateReducer(result, { type: "NEW_SCRAMBLE" });
    expect(next.stage).toBe("MATCH_LOADING");
    expect(next.overlay).toBe("NONE");
    expect(next.loadingId).toBe(5);
    expect(next.mode).toBe("practice");
  });

  it("drives bot race through loading, countdown, play, solved, and result", () => {
    const modeSelect = gameStateReducer(initialGameState, { type: "OPEN_MODE_SELECT" });
    const loading = gameStateReducer(modeSelect, { type: "SELECT_BOT_RACE" });

    expect(loading.stage).toBe("MATCH_LOADING");
    expect(loading.mode).toBe("bot-race");

    const countdown = gameStateReducer(loading, { type: "LOADING_COMPLETE" });
    expect(countdown.stage).toBe("COUNTDOWN");

    const playing = gameStateReducer(countdown, { type: "COUNTDOWN_COMPLETE" });
    expect(playing.stage).toBe("PLAYING");

    const solved = gameStateReducer(playing, { type: "SOLVE_COMPLETE" });
    expect(solved.stage).toBe("SOLVED");

    const result = gameStateReducer(solved, { type: "SHOW_RESULTS" });
    expect(result.stage).toBe("RESULT");
    expect(result.mode).toBe("bot-race");
  });
});
