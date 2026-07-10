import { describe, expect, it } from "vitest";
import {
  applyMove,
  createSolvedCube,
  makeMove,
  parseMove,
  serializeCube,
} from "./cubeEngine";

describe("cube engine", () => {
  it("creates a solved 3x3 cube with 26 visible cubies and 54 stickers", () => {
    const cube = createSolvedCube();
    const stickerCount = cube.reduce((total, cubie) => total + cubie.stickers.length, 0);

    expect(cube).toHaveLength(26);
    expect(stickerCount).toBe(54);
  });

  it("returns to solved after four quarter turns", () => {
    const solved = createSolvedCube();
    const rotated = Array.from({ length: 4 }).reduce(
      (cube) => applyMove(cube, makeMove("R")),
      solved,
    );

    expect(serializeCube(rotated)).toBe(serializeCube(solved));
  });

  it("returns to solved after a move and its inverse", () => {
    const solved = createSolvedCube();
    const moved = applyMove(applyMove(solved, parseMove("F")), parseMove("F'"));

    expect(serializeCube(moved)).toBe(serializeCube(solved));
  });

  it("returns to solved after two half turns", () => {
    const solved = createSolvedCube();
    const moved = applyMove(applyMove(solved, parseMove("U2")), parseMove("U2"));

    expect(serializeCube(moved)).toBe(serializeCube(solved));
  });
});
