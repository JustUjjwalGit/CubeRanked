import { describe, expect, it } from "vitest";
import { applyMove, createSolvedCube, serializeCube } from "./cubeEngine";
import { BOT_PROFILES, createBotOpponent } from "./botRace";
import { cubeFromScramble } from "./scramble";

describe("botRace", () => {
  it("plans real cube moves that solve the shared scramble", () => {
    const scramble = ["R", "U2", "F'", "L", "D2", "R2"];
    const bot = createBotOpponent(scramble);
    const solved = bot.plan.reduce(
      (cube, plannedMove) => applyMove(cube, plannedMove.move),
      cubeFromScramble(scramble),
    );

    expect(bot.plan.length).toBeGreaterThan(scramble.length - 1);
    expect(bot.projectedTimeMs).toBeGreaterThan(0);
    expect(serializeCube(solved)).toBe(serializeCube(createSolvedCube()));
  });

  it("keeps Stage 9 bot timing ranges", () => {
    expect(BOT_PROFILES.map((profile) => ({
      difficulty: profile.difficulty,
      recognitionDelayMs: profile.recognitionDelayMs,
      tpsRange: profile.tpsRange,
      pauseMs: profile.pauseMs,
    }))).toEqual([
      { difficulty: "Beginner", recognitionDelayMs: [800, 1_500], tpsRange: [2, 3], pauseMs: [50, 300] },
      { difficulty: "Intermediate", recognitionDelayMs: [400, 800], tpsRange: [4, 5], pauseMs: [50, 300] },
      { difficulty: "Advanced", recognitionDelayMs: [200, 500], tpsRange: [6, 8], pauseMs: [50, 300] },
      { difficulty: "Expert", recognitionDelayMs: [50, 200], tpsRange: [9, 11], pauseMs: [50, 300] },
    ]);
  });
});
