import { describe, expect, it } from "vitest";
import { calculateStats, createSolveRecord, formatSolveTime, formatTime } from "./sessionStats";

describe("session stats", () => {
  it("formats times and penalties", () => {
    expect(formatTime(12_345)).toBe("12.345");
    expect(formatTime(73_210)).toBe("1:13.210");
    expect(formatSolveTime(createSolveRecord({
      rawTimeMs: 10_000,
      penalty: "+2",
      scramble: ["R"],
      moveCount: 10,
    }))).toBe("12.000+");
  });

  it("calculates best, worst, averages, and ignores DNF in averages", () => {
    const solves = [
      createSolveRecord({ rawTimeMs: 10_000, penalty: "none", scramble: ["R"], moveCount: 20 }),
      createSolveRecord({ rawTimeMs: 12_000, penalty: "none", scramble: ["U"], moveCount: 24 }),
      createSolveRecord({ rawTimeMs: 9_000, penalty: "+2", scramble: ["F"], moveCount: 18 }),
      createSolveRecord({ rawTimeMs: 8_000, penalty: "DNF", scramble: ["L"], moveCount: 10 }),
      createSolveRecord({ rawTimeMs: 14_000, penalty: "none", scramble: ["D"], moveCount: 28 }),
    ];
    const stats = calculateStats(solves);

    expect(stats.solveCount).toBe(5);
    expect(stats.bestSolve?.finalTimeMs).toBe(10_000);
    expect(stats.worstSolve?.finalTimeMs).toBe(14_000);
    expect(stats.sessionAverageMs).toBe(11_750);
    expect(stats.averageOf5Ms).toBeNull();
  });
});
