import { describe, expect, it } from "vitest";
import { generateWcaScramble } from "./scramble";

const AXIS_BY_FACE: Record<string, string> = {
  R: "x",
  L: "x",
  U: "y",
  D: "y",
  F: "z",
  B: "z",
};

describe("WCA scramble generator", () => {
  it("creates 20 move scrambles with no repeated face or 3 same-axis moves", () => {
    for (let index = 0; index < 100; index += 1) {
      const scramble = generateWcaScramble(20);

      expect(scramble).toHaveLength(20);

      for (let moveIndex = 1; moveIndex < scramble.length; moveIndex += 1) {
        expect(scramble[moveIndex][0]).not.toBe(scramble[moveIndex - 1][0]);
      }

      for (let moveIndex = 2; moveIndex < scramble.length; moveIndex += 1) {
        const axes = scramble.slice(moveIndex - 2, moveIndex + 1).map((move) => AXIS_BY_FACE[move[0]]);
        expect(new Set(axes).size).toBeGreaterThan(1);
      }
    }
  });
});
