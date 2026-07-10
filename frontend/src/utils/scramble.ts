import { applyMove, createSolvedCube, parseMove, type CubeState } from "./cubeEngine";

export type Penalty = "none" | "+2" | "DNF";

const AXIS_BY_FACE: Record<string, "x" | "y" | "z"> = {
  R: "x",
  L: "x",
  U: "y",
  D: "y",
  F: "z",
  B: "z",
};

const FACES = ["R", "L", "U", "D", "F", "B"] as const;
const SUFFIXES = ["", "'", "2"] as const;

export function generateWcaScramble(length = 20): string[] {
  const scramble: string[] = [];
  const recentAxes: Array<"x" | "y" | "z"> = [];
  let previousFace = "";

  while (scramble.length < length) {
    const face = FACES[Math.floor(Math.random() * FACES.length)];
    const axis = AXIS_BY_FACE[face];

    if (face === previousFace) {
      continue;
    }

    if (recentAxes.length >= 2 && recentAxes.every((recentAxis) => recentAxis === axis)) {
      continue;
    }

    const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
    scramble.push(`${face}${suffix}`);
    previousFace = face;
    recentAxes.push(axis);

    if (recentAxes.length > 2) {
      recentAxes.shift();
    }
  }

  return scramble;
}

export function scrambleToString(scramble: string[]): string {
  return scramble.join(" ");
}

export function cubeFromScramble(scramble: string[]): CubeState {
  return scramble.reduce(
    (cube, notation) => applyMove(cube, parseMove(notation)),
    createSolvedCube(),
  );
}
